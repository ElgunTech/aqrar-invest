package az.agro.portal.service;

import az.agro.portal.domain.AppUser;
import az.agro.portal.domain.InvestmentApplication;
import az.agro.portal.repo.ApplicationRepository;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Integrity signals for evaluators: patterns that deserve a second look (shared contacts across applicants,
 * copied business plans, implausible amounts, identity mismatches, the viewer's own conflict of interest).
 * Signals inform the commission; they never block or decide anything on their own.
 */
@Service
public class IntegrityService {

    public record Signal(String level, String code, String text) {
    }

    private static final double PLAN_SIMILARITY = 0.85;

    private final ApplicationRepository applications;

    public IntegrityService(ApplicationRepository applications) {
        this.applications = applications;
    }

    public List<Signal> signals(InvestmentApplication a, AppUser viewer) {
        List<Signal> out = new ArrayList<>();
        List<InvestmentApplication> others = applications.findAll().stream()
                .filter(o -> !o.getId().equals(a.getId()) && !o.getApplicant().getId().equals(a.getApplicant().getId()))
                .toList();

        String phone = digits(a.getPhone());
        Set<Long> seenApplicants = new HashSet<>();
        for (InvestmentApplication o : others) {
            if (!seenApplicants.add(o.getApplicant().getId())) continue; // one signal per other person
            if (!phone.isEmpty() && phone.equals(digits(o.getPhone()))) {
                out.add(new Signal("HIGH", "SHARED_PHONE", "Eyni telefon nömrəsi başqa müraciətçidə də var: "
                        + o.getApplicantName() + " (" + o.getApplicationNumber() + ")"));
            }
            if (a.getEmail() != null && a.getEmail().equalsIgnoreCase(o.getEmail())) {
                out.add(new Signal("HIGH", "SHARED_EMAIL", "Eyni e-poçt başqa müraciətçidə də var: " + o.getApplicationNumber()));
            }
        }

        Set<String> mine = shingles(a.getBusinessPlan());
        others.stream()
                .map(o -> Map.entry(o, jaccard(mine, shingles(o.getBusinessPlan()))))
                .filter(e -> e.getValue() >= PLAN_SIMILARITY)
                .max(Map.Entry.comparingByValue())
                .ifPresent(e -> out.add(new Signal("HIGH", "COPIED_PLAN", "Biznes plan " + e.getKey().getApplicationNumber()
                        + " müraciətindəki ilə " + Math.round(e.getValue() * 100) + "% eynidir")));

        double perHa = a.getPlannedInvestment() / Math.max(1, a.getPlot().getAreaHa());
        double minPerHa = a.getPlot().getMinInvestment() / Math.max(1, a.getPlot().getAreaHa());
        if (minPerHa > 0 && perHa < minPerHa * 0.5) {
            out.add(new Signal("MEDIUM", "LOW_INVESTMENT", "Hektara düşən investisiya (" + Math.round(perHa) + " ₼) minimum tələbin yarısından azdır"));
        } else if (minPerHa > 0 && perHa > minPerHa * 6) {
            out.add(new Signal("MEDIUM", "INFLATED_INVESTMENT", "Hektara düşən investisiya (" + Math.round(perHa) + " ₼) sahə üçün real görünmür"));
        }

        String accountTax = a.getApplicant().getTaxId();
        if (accountTax != null && !accountTax.isBlank() && a.getApplicantType().name().equals("INDIVIDUAL")
                && !accountTax.equalsIgnoreCase(a.getTaxId())) {
            out.add(new Signal("HIGH", "TAX_MISMATCH", "Müraciətdəki FİN hesabda təsdiqlənmiş FİN ilə uyğun gəlmir"));
        }

        if (viewer != null && viewer.getRole().name().equals("INVESTOR") == false) {
            Set<String> shared = surnames(viewer.getFullName());
            shared.retainAll(surnames(a.getApplicantName()));
            if (!shared.isEmpty()) {
                out.add(new Signal("HIGH", "CONFLICT_SURNAME", "Maraqlar toqquşması ehtimalı: müraciətçi ilə sizin soyadınız eynidir"));
            }
            if (!digits(viewer.getPhone()).isEmpty() && digits(viewer.getPhone()).equals(phone)) {
                out.add(new Signal("HIGH", "CONFLICT_PHONE", "Maraqlar toqquşması: müraciətçinin telefonu sizin nömrənizdir"));
            }
        }
        return out;
    }

    public int count(InvestmentApplication a) {
        return signals(a, null).size();
    }

    private static String digits(String s) {
        String d = s == null ? "" : s.replaceAll("\\D", "");
        return d.length() > 9 ? d.substring(d.length() - 9) : d;
    }

    /**
     * Family names in a full name, whatever the word order ("Rafael Qurbanov" or "Qurbanov Rafael").
     * Azerbaijani surnames end in -ov/-ev/-yev, -zadə, -lı/-li; "Hüseynova" and "Hüseynov" count as one.
     */
    private static Set<String> surnames(String name) {
        Set<String> out = new HashSet<>();
        if (name == null) return out;
        for (String w : name.replace("\"", "").toLowerCase(Locale.ROOT).split("\\s+")) {
            String base = w.length() > 4 && w.endsWith("a") ? w.substring(0, w.length() - 1) : w;
            if (base.length() > 3 && (base.endsWith("ov") || base.endsWith("ev") || base.endsWith("zadə")
                    || base.endsWith("lı") || base.endsWith("li"))) {
                out.add(base);
            }
        }
        return out;
    }

    private static Set<String> shingles(String text) {
        String[] w = (text == null ? "" : text.toLowerCase(Locale.ROOT)).replaceAll("[^\\p{L}\\p{N}\\s]", " ").trim().split("\\s+");
        Set<String> s = new HashSet<>();
        for (int i = 0; i + 2 < w.length; i++) s.add(w[i] + " " + w[i + 1] + " " + w[i + 2]);
        return s;
    }

    private static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        return (double) inter.size() / (a.size() + b.size() - inter.size());
    }
}
