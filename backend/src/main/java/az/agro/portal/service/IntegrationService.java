package az.agro.portal.service;

import az.agro.portal.domain.*;
import az.agro.portal.integration.EktisClient;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.IntegrationEventRepository;
import az.agro.portal.web.ApiException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * EKTİS integration using the transactional outbox pattern:
 * business changes write an event row in the same transaction; a scheduler delivers it with retries.
 * Inbound EKTİS callbacks are stored as INBOUND events and applied to the application.
 */
@Service
public class IntegrationService {

    private static final Logger log = LoggerFactory.getLogger(IntegrationService.class);

    public static final String APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED";
    public static final String APPLICATION_STATUS_CHANGED = "APPLICATION_STATUS_CHANGED";
    public static final String COMPETITION_PUBLISHED = "COMPETITION_PUBLISHED";

    public record InboundEvent(String eventType, String applicationNumber, String ektisReference, String message,
                               Map<String, Object> data) {
    }

    private final IntegrationEventRepository events;
    private final ApplicationRepository applications;
    private final NotificationService notifications;
    private final EktisClient ektis;
    private final ObjectMapper json;
    private final TransactionTemplate tx;
    private final int maxAttempts;
    private LedgerService ledger;

    @org.springframework.beans.factory.annotation.Autowired
    void setLedger(LedgerService ledger) { this.ledger = ledger; }

    public IntegrationService(IntegrationEventRepository events, ApplicationRepository applications,
                              NotificationService notifications, EktisClient ektis, ObjectMapper json,
                              PlatformTransactionManager txManager, @Value("${app.ektis.max-attempts}") int maxAttempts) {
        this.events = events;
        this.applications = applications;
        this.notifications = notifications;
        this.ektis = ektis;
        this.json = json;
        this.tx = new TransactionTemplate(txManager);
        this.maxAttempts = maxAttempts;
    }

    // ------------------------------------------------------------------ outbound: enqueue

    public void enqueueApplicationSubmitted(InvestmentApplication a) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("schemaVersion", "1.0");
        p.put("applicationNumber", a.getApplicationNumber());
        p.put("submittedAt", a.getCreatedAt().toString());
        p.put("competitionCode", a.getCompetition().getCode());
        p.put("applicant", Map.of(
                "type", a.getApplicantType().name(),
                "name", a.getApplicantName(),
                "taxId", a.getTaxId(),
                "phone", nz(a.getPhone()),
                "email", nz(a.getEmail())));
        p.put("plot", Map.of(
                "code", a.getPlot().getCode(),
                "cadastreNumber", nz(a.getPlot().getCadastreNumber()),
                "district", a.getPlot().getDistrict(),
                "areaHa", a.getPlot().getAreaHa()));
        p.put("investment", Map.of(
                "activityType", a.getActivityType().name(),
                "plannedCrop", nz(a.getPlannedCrop()),
                "amountAzn", a.getPlannedInvestment(),
                "ownFundsPercent", a.getOwnFundsPercent(),
                "jobsCreated", a.getJobsCreated(),
                "returneeJobs", a.getReturneeJobs(),
                "projectMonths", a.getProjectMonths()));
        save(IntegrationEvent.Direction.OUTBOUND, APPLICATION_SUBMITTED, a.getApplicationNumber(), p, IntegrationEventStatus.PENDING);
    }

    public void enqueueStatusChanged(InvestmentApplication a, ApplicationStatus from, ApplicationStatus to, String comment) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("schemaVersion", "1.0");
        p.put("applicationNumber", a.getApplicationNumber());
        p.put("fromStatus", from == null ? null : from.name());
        p.put("toStatus", to.name());
        p.put("comment", comment);
        p.put("changedAt", Instant.now().toString());
        save(IntegrationEvent.Direction.OUTBOUND, APPLICATION_STATUS_CHANGED, a.getApplicationNumber(), p, IntegrationEventStatus.PENDING);
    }

    public void enqueueCompetitionPublished(Competition c) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("schemaVersion", "1.0");
        p.put("competitionCode", c.getCode());
        p.put("title", c.getTitle());
        p.put("deadline", c.getDeadline().toString());
        p.put("plots", c.getPlots().stream().map(pl -> Map.of(
                "code", pl.getCode(),
                "cadastreNumber", nz(pl.getCadastreNumber()),
                "district", pl.getDistrict(),
                "areaHa", pl.getAreaHa(),
                "activityType", pl.getActivityType().name())).toList());
        save(IntegrationEvent.Direction.OUTBOUND, COMPETITION_PUBLISHED, c.getCode(), p, IntegrationEventStatus.PENDING);
    }

    private IntegrationEvent save(IntegrationEvent.Direction dir, String type, String aggregateId, Map<String, Object> payload,
                                  IntegrationEventStatus status) {
        try {
            return events.save(new IntegrationEvent(dir, type, aggregateId, json.writeValueAsString(payload), status));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------------ outbound: deliver

    @Scheduled(fixedDelayString = "${app.ektis.outbox-interval-ms}", initialDelay = 5000)
    public void processOutbox() {
        List<IntegrationEvent> pending = events.findTop20ByDirectionAndStatusOrderByCreatedAtAsc(
                IntegrationEvent.Direction.OUTBOUND, IntegrationEventStatus.PENDING);
        for (IntegrationEvent e : pending) {
            tx.executeWithoutResult(s -> deliver(events.findById(e.getId()).orElseThrow()));
        }
    }

    private void deliver(IntegrationEvent e) {
        try {
            Map<String, Object> payload = json.readValue(e.getPayload(), new TypeReference<>() {
            });
            switch (e.getEventType()) {
                case APPLICATION_SUBMITTED -> {
                    String ref = ektis.submitApplication(payload);
                    e.setExternalReference(ref);
                    applications.findByApplicationNumber(e.getAggregateId()).ifPresent(a -> {
                        a.setEktisReference(ref);
                        if (a.getEktisStatus() != EktisSyncStatus.VERIFIED) a.setEktisStatus(EktisSyncStatus.SENT);
                    });
                }
                case APPLICATION_STATUS_CHANGED -> {
                    Optional<InvestmentApplication> app = applications.findByApplicationNumber(e.getAggregateId());
                    String ref = app.map(InvestmentApplication::getEktisReference).orElse(null);
                    if (ref == null) return; // not registered in EKTİS yet — try again on the next run
                    ektis.sendStatusUpdate(ref, payload);
                    e.setExternalReference(ref);
                }
                case COMPETITION_PUBLISHED -> e.setExternalReference(ektis.publishCompetition(payload));
                default -> throw new IllegalStateException("Unknown event type " + e.getEventType());
            }
            e.setStatus(IntegrationEventStatus.SENT);
            e.setProcessedAt(Instant.now());
            e.setAttempts(e.getAttempts() + 1);
            e.setLastError(null);
        } catch (Exception ex) {
            e.setAttempts(e.getAttempts() + 1);
            String msg = ex.getClass().getSimpleName() + ": " + ex.getMessage();
            e.setLastError(msg.length() > 1000 ? msg.substring(0, 1000) : msg);
            if (e.getAttempts() >= maxAttempts) {
                e.setStatus(IntegrationEventStatus.FAILED);
                if (APPLICATION_SUBMITTED.equals(e.getEventType())) {
                    applications.findByApplicationNumber(e.getAggregateId()).ifPresent(a -> a.setEktisStatus(EktisSyncStatus.FAILED));
                }
            }
            log.warn("EKTİS delivery failed for event {} (attempt {}): {}", e.getId(), e.getAttempts(), msg);
        }
    }

    @Transactional
    public void retry(Long eventId) {
        IntegrationEvent e = events.findById(eventId).orElseThrow(() -> ApiException.notFound("Hadisə"));
        if (e.getDirection() != IntegrationEvent.Direction.OUTBOUND || e.getStatus() == IntegrationEventStatus.SENT) {
            throw ApiException.conflict("Bu hadisə təkrar göndərilə bilməz");
        }
        e.setStatus(IntegrationEventStatus.PENDING);
        e.setAttempts(0);
    }

    @Transactional(readOnly = true)
    public List<IntegrationEvent> latest() {
        return events.findTop200ByOrderByCreatedAtDesc();
    }

    public Optional<Map<String, Object>> findFarmer(String taxId) {
        return ektis.findFarmer(taxId);
    }

    // ------------------------------------------------------------------ inbound (webhook from EKTİS)

    @Transactional
    public Map<String, Object> receive(InboundEvent in) {
        if (in.eventType() == null || in.applicationNumber() == null) throw ApiException.badRequest("eventType və applicationNumber tələb olunur");
        Map<String, Object> stored = new LinkedHashMap<>();
        stored.put("eventType", in.eventType());
        stored.put("applicationNumber", in.applicationNumber());
        stored.put("ektisReference", in.ektisReference());
        stored.put("message", in.message());
        stored.put("data", in.data());
        IntegrationEvent e = save(IntegrationEvent.Direction.INBOUND, in.eventType(), in.applicationNumber(), stored,
                IntegrationEventStatus.RECEIVED);
        e.setExternalReference(in.ektisReference());
        e.setProcessedAt(Instant.now());

        InvestmentApplication a = applications.findByApplicationNumber(in.applicationNumber())
                .orElseThrow(() -> ApiException.notFound("Müraciət"));
        if (in.ektisReference() != null) a.setEktisReference(in.ektisReference());
        String text = in.message() == null ? in.eventType() : in.message();
        switch (in.eventType()) {
            case "FARMER_VERIFIED", "FARMER_REGISTERED" -> {
                a.setEktisStatus(EktisSyncStatus.VERIFIED);
                ektisNote(a, text);
                notifications.notify(a.getApplicant(), "EKTİS təsdiqi: " + a.getApplicationNumber(), text,
                        "/kabinet/" + a.getId());
            }
            default -> ektisNote(a, text);
        }
        return Map.of("accepted", true, "eventId", e.getId());
    }

    /** EKTİS remarks are part of the decision history, so they are sealed into the ledger like any other entry. */
    private void ektisNote(InvestmentApplication a, String text) {
        StatusChange c = new StatusChange(a.getStatus(), a.getStatus(), "EKTİS: " + text, "EKTİS");
        a.addHistory(c);
        ledger.status(a, c);
    }

    private static Object nz(Object o) {
        return o == null ? "" : o;
    }
}
