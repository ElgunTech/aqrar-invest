package az.agro.portal.service;

import az.agro.portal.domain.*;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Competitions and their results as an Open Contracting Data Standard (OCDS 1.1) release package. Each published
 * competition is a contracting process (ocid); its land plots are the items, received applications the tenderers and
 * approved applications the awards. Natural persons are not named (only legal entities), and draft or unapproved
 * competitions are not published.
 */
@Service
public class OcdsService {

    /** Prototype prefix; a production deployment registers its own with the Open Contracting Partnership. */
    public static final String PREFIX = "ocds-aqrar";
    private static final String BUYER_ID = "AZ-KTN";
    private static final String BUYER = "Azərbaycan Respublikasının Kənd Təsərrüfatı Nazirliyi";

    private final CompetitionRepository competitions;
    private final ApplicationRepository applications;

    public OcdsService(CompetitionRepository competitions, ApplicationRepository applications) {
        this.competitions = competitions;
        this.applications = applications;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> releasePackage(String baseUrl) {
        List<InvestmentApplication> apps = applications.findAll();
        List<Map<String, Object>> releases = competitions.findAll().stream()
                .filter(c -> c.getStatus() == CompetitionStatus.PUBLISHED || c.getStatus() == CompetitionStatus.CLOSED)
                .sorted(Comparator.comparing(Competition::getCode))
                .map(c -> release(c, apps.stream().filter(a -> a.getCompetition().getId().equals(c.getId())).toList()))
                .toList();
        Map<String, Object> pkg = new LinkedHashMap<>();
        pkg.put("uri", baseUrl + "/api/v1/public/open-data/ocds");
        pkg.put("version", "1.1");
        pkg.put("publishedDate", Instant.now().toString());
        pkg.put("publisher", Map.of("name", "Aqrar İnvest portalı (prototip)"));
        pkg.put("license", "https://creativecommons.org/licenses/by/4.0/");
        pkg.put("publicationPolicy", baseUrl + "/haqqinda");
        pkg.put("releases", releases);
        return pkg;
    }

    private Map<String, Object> release(Competition c, List<InvestmentApplication> apps) {
        List<InvestmentApplication> winners = apps.stream().filter(a -> a.getStatus() == ApplicationStatus.APPROVED).toList();
        String ocid = PREFIX + "-" + c.getCode();

        List<Map<String, Object>> parties = new ArrayList<>();
        parties.add(party(BUYER_ID, BUYER, List.of("buyer", "procuringEntity")));
        Map<String, Map<String, Object>> tenderers = new LinkedHashMap<>();
        for (InvestmentApplication a : apps) {
            String id = partyId(a);
            tenderers.computeIfAbsent(id, k -> party(id, publicName(a), new ArrayList<>(List.of("tenderer"))));
            if (a.getStatus() == ApplicationStatus.APPROVED) {
                @SuppressWarnings("unchecked") List<String> roles = (List<String>) tenderers.get(id).get("roles");
                if (!roles.contains("supplier")) roles.add("supplier");
            }
        }
        parties.addAll(tenderers.values());

        Map<String, Object> tender = new LinkedHashMap<>();
        tender.put("id", c.getCode());
        tender.put("title", c.getTitle());
        tender.put("description", c.getDescription());
        tender.put("status", c.getStatus() == CompetitionStatus.PUBLISHED && c.isOpen() ? "active" : "complete");
        tender.put("procurementMethod", "open");
        tender.put("procurementMethodDetails", "Kənd təsərrüfatı torpaqlarının icarəsi üzrə investisiya müsabiqəsi");
        tender.put("mainProcurementCategory", "works");
        tender.put("awardCriteria", "ratedCriteria");
        tender.put("awardCriteriaDetails", "Avtomatik bal (investisiya, iş yerləri, «Böyük Qayıdış», təcrübə, AI uyğunluğu) və ən azı 2 komissiya üzvünün müstəqil balı");
        Map<String, Object> period = new LinkedHashMap<>();
        if (c.getStartDate() != null) period.put("startDate", c.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC).toString());
        period.put("endDate", c.getDeadline().atTime(23, 59, 59).toInstant(ZoneOffset.UTC).toString());
        tender.put("tenderPeriod", period);
        tender.put("items", c.getPlots().stream().sorted(Comparator.comparing(LandPlot::getCode)).map(OcdsService::item).toList());
        tender.put("numberOfTenderers", tenderers.size());
        tender.put("tenderers", tenderers.values().stream().map(p -> Map.of("id", p.get("id"), "name", p.get("name"))).toList());

        List<Map<String, Object>> awards = winners.stream().map(a -> {
            Map<String, Object> aw = new LinkedHashMap<>();
            aw.put("id", a.getApplicationNumber());
            aw.put("title", "İcarə hüququ: " + a.getPlot().getCode() + " · " + a.getPlot().getTitle());
            aw.put("status", "active");
            aw.put("date", a.getHistory().stream().filter(h -> h.getToStatus() == ApplicationStatus.APPROVED)
                    .map(h -> h.getChangedAt().toString()).findFirst().orElse(a.getUpdatedAt().toString()));
            aw.put("value", Map.of("amount", a.getPlannedInvestment(), "currency", "AZN"));
            aw.put("description", "Dəyər: qalibin öhdəlik götürdüyü investisiya. Yaradılacaq iş yerləri: " + a.getJobsCreated()
                    + (a.getReturneeJobs() > 0 ? ", o cümlədən keçmiş məcburi köçkünlər üçün " + a.getReturneeJobs() : "") + ".");
            aw.put("suppliers", List.of(Map.of("id", partyId(a), "name", publicName(a))));
            aw.put("items", List.of(item(a.getPlot())));
            return aw;
        }).toList();

        List<String> tags = new ArrayList<>(List.of("tender"));
        if (!awards.isEmpty()) tags.add("award");

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("ocid", ocid);
        r.put("id", ocid + "-" + (awards.isEmpty() ? "tender" : "award"));
        r.put("date", Instant.now().toString());
        r.put("tag", tags);
        r.put("initiationType", "tender");
        r.put("language", "az");
        r.put("parties", parties);
        r.put("buyer", Map.of("id", BUYER_ID, "name", BUYER));
        r.put("tender", tender);
        if (!awards.isEmpty()) r.put("awards", awards);
        return r;
    }

    private static Map<String, Object> item(LandPlot p) {
        Map<String, Object> i = new LinkedHashMap<>();
        i.put("id", p.getCode());
        i.put("description", p.getTitle() + ", " + p.getDistrict() + " rayonu, " + p.getVillage() + " (" + p.getActivityType().getLabel() + ")");
        i.put("quantity", p.getAreaHa());
        i.put("unit", Map.of("name", "hektar", "scheme", "UNCEFACT", "id", "HAR"));
        Map<String, Object> loc = new LinkedHashMap<>();
        loc.put("description", p.getDistrict() + ", " + p.getVillage());
        loc.put("geometry", Map.of("type", "Point", "coordinates", List.of(p.getLongitude(), p.getLatitude())));
        if (p.getAnamaRef() != null) loc.put("gazetteer", Map.of("scheme", "ANAMA", "identifiers", List.of(p.getAnamaRef())));
        i.put("deliveryLocation", loc);
        return i;
    }

    private static Map<String, Object> party(String id, String name, List<String> roles) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", id);
        p.put("name", name);
        p.put("roles", roles);
        return p;
    }

    /** Legal entities are identified by name; natural persons stay anonymous in open data. */
    private static String publicName(InvestmentApplication a) {
        return a.getApplicantType() == ApplicantType.COMPANY ? a.getApplicantName() : "Fiziki şəxs (" + a.getApplicationNumber() + ")";
    }

    private static String partyId(InvestmentApplication a) {
        return a.getApplicantType() == ApplicantType.COMPANY ? "AZ-VOEN-" + a.getTaxId() : "AZ-PERSON-" + a.getApplicationNumber();
    }
}
