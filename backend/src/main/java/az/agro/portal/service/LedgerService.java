package az.agro.portal.service;

import az.agro.portal.domain.EvaluatorScore;
import az.agro.portal.domain.InvestmentApplication;
import az.agro.portal.domain.LedgerEntry;
import az.agro.portal.domain.LedgerEntry.Kind;
import az.agro.portal.domain.StatusChange;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.EvaluatorScoreRepository;
import az.agro.portal.repo.LedgerRepository;
import az.agro.portal.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * Tamper-evident decision ledger. Every status change and every commission score is appended as a canonical JSON
 * payload whose SHA-256 hash covers the previous entry's hash, forming a chain from a fixed genesis value.
 * <p>
 * Verification answers two questions: is the chain itself intact (nobody edited or deleted a ledger row), and do the
 * application's current records still match what was sealed (nobody edited the history or a score in the database).
 * In production the head hash would also be published periodically (e.g. on the ministry website) so that even a
 * full rewrite of the ledger by a database administrator becomes visible.
 */
@Service
public class LedgerService {

    public static final String GENESIS = "0".repeat(64);

    public record EntryView(Long seq, String kind, String summary, String recordedAt, String hash, String prevHash) {}
    public record Verification(String applicationNumber, boolean chainValid, boolean recordsValid, int chainLength,
                               String headHash, List<EntryView> entries, List<String> issues) {
        public boolean valid() { return chainValid && recordsValid; }
    }

    private final LedgerRepository ledger;
    private final ApplicationRepository applications;
    private final EvaluatorScoreRepository scores;
    private final ObjectMapper json = new ObjectMapper();

    public LedgerService(LedgerRepository ledger, ApplicationRepository applications, EvaluatorScoreRepository scores) {
        this.ledger = ledger;
        this.applications = applications;
        this.scores = scores;
    }

    // ------------------------------------------------------------------ writing

    public synchronized void status(InvestmentApplication a, StatusChange c) {
        append(a.getApplicationNumber(), Kind.STATUS, payload(c), c.getChangedAt());
    }

    public synchronized void score(InvestmentApplication a, EvaluatorScore s) {
        append(a.getApplicationNumber(), Kind.SCORE, payload(s), s.getUpdatedAt());
    }

    private void append(String number, Kind kind, Map<String, Object> payload, Instant at) {
        String prev = ledger.findTopByOrderByIdDesc().map(LedgerEntry::getHash).orElse(GENESIS);
        String body = canonical(payload);
        ledger.save(new LedgerEntry(number, kind, body, prev, hash(prev, number, kind, body), at == null ? Instant.now() : at));
    }

    // ------------------------------------------------------------------ verifying

    @Transactional(readOnly = true)
    public Verification verify(String number) {
        InvestmentApplication a = applications.findByApplicationNumber(number).orElseThrow(() -> ApiException.notFound("Müraciət"));
        List<String> issues = new ArrayList<>();

        // 1. the chain: every link must hash to its stored value and point at the previous one
        List<LedgerEntry> all = ledger.findAllByOrderByIdAsc();
        String prev = GENESIS;
        boolean chainValid = true;
        for (LedgerEntry e : all) {
            String expected = hash(prev, e.getApplicationNumber(), e.getKind(), e.getPayload());
            if (!e.getPrevHash().equals(prev) || !e.getHash().equals(expected)) {
                chainValid = false;
                issues.add("Jurnalın #" + e.getId() + " qeydi möhürləndikdən sonra dəyişdirilib və ya zəncirdən qeyd silinib");
                break;
            }
            prev = e.getHash();
        }

        // 2. the application's current records against what was sealed
        List<LedgerEntry> mine = all.stream().filter(e -> e.getApplicationNumber().equals(number)).toList();
        List<String> sealedStatus = mine.stream().filter(e -> e.getKind() == Kind.STATUS).map(LedgerEntry::getPayload).toList();
        List<String> currentStatus = a.getHistory().stream().map(c -> canonical(payload(c))).toList();
        List<String> missing = new ArrayList<>(sealedStatus);
        currentStatus.forEach(missing::remove);
        List<String> unsealed = new ArrayList<>(currentStatus);
        sealedStatus.forEach(unsealed::remove);
        if (!missing.isEmpty() || !unsealed.isEmpty()) {
            issues.add("Müraciətin status tarixçəsi jurnalda möhürlənmiş vəziyyətdən fərqlənir (" + Math.max(missing.size(), unsealed.size()) + " qeyd)");
        }
        Map<String, String> sealedScores = new HashMap<>();
        mine.stream().filter(e -> e.getKind() == Kind.SCORE).forEach(e -> sealedScores.put(evaluatorOf(e.getPayload()), e.getPayload()));
        for (EvaluatorScore s : scores.findByApplicationIdOrderByUpdatedAtAsc(a.getId())) {
            String now = canonical(payload(s));
            String sealed = sealedScores.get(s.getEvaluator().getEmail());
            if (!now.equals(sealed)) issues.add("Komissiya üzvü " + s.getEvaluator().getFullName() + " üçün bal jurnaldakından fərqlənir");
        }
        boolean recordsValid = issues.stream().noneMatch(i -> i.startsWith("Müraciətin") || i.startsWith("Komissiya"));

        List<EntryView> views = mine.stream().map(e -> new EntryView(e.getId(), e.getKind().name(), summary(e), e.getRecordedAt().toString(),
                e.getHash(), e.getPrevHash())).toList();
        return new Verification(number, chainValid, recordsValid, all.size(), prev, views, issues);
    }

    // ------------------------------------------------------------------ canonical form

    private static Map<String, Object> payload(StatusChange c) {
        Map<String, Object> m = new TreeMap<>();
        m.put("from", c.getFromStatus() == null ? null : c.getFromStatus().name());
        m.put("to", c.getToStatus() == null ? null : c.getToStatus().name());
        m.put("comment", c.getComment());
        m.put("by", c.getChangedBy());
        m.put("at", c.getChangedAt() == null ? null : c.getChangedAt().toEpochMilli());
        return m;
    }

    private static Map<String, Object> payload(EvaluatorScore s) {
        Map<String, Object> m = new TreeMap<>();
        m.put("evaluator", s.getEvaluator().getEmail());
        m.put("feasibility", s.getFeasibility());
        m.put("financing", s.getFinancing());
        m.put("socialImpact", s.getSocialImpact());
        m.put("technology", s.getTechnology());
        m.put("comment", s.getComment());
        m.put("total", s.total());
        return m;
    }

    private String canonical(Map<String, Object> m) {
        try {
            return json.writeValueAsString(new TreeMap<>(m));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String evaluatorOf(String payload) {
        try {
            return json.readTree(payload).path("evaluator").asText();
        } catch (Exception e) {
            return "";
        }
    }

    private String summary(LedgerEntry e) {
        try {
            var n = json.readTree(e.getPayload());
            if (e.getKind() == Kind.SCORE) {
                return "Komissiya balı: " + n.path("total").asInt() + "/100";
            }
            String to = label(n.path("to").asText());
            String from = n.path("from").isNull() ? null : label(n.path("from").asText());
            return (from == null || from.equals(to) ? to : from + " → " + to) + " (" + n.path("by").asText() + ")";
        } catch (Exception ex) {
            return e.getKind().name();
        }
    }

    private static String label(String code) {
        try {
            return az.agro.portal.domain.ApplicationStatus.valueOf(code).getLabel();
        } catch (Exception e) {
            return code;
        }
    }

    static String hash(String prev, String number, Kind kind, String body) {
        try {
            MessageDigest d = MessageDigest.getInstance("SHA-256");
            byte[] h = d.digest((prev + "|" + number + "|" + kind + "|" + body).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
