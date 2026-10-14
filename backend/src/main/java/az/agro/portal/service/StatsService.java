package az.agro.portal.service;

import az.agro.portal.domain.*;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
import az.agro.portal.repo.LandPlotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Aggregates for the public transparency page and the admin dashboard. */
@Service
public class StatsService {

    private final LandPlotRepository plots;
    private final CompetitionRepository competitions;
    private final ApplicationRepository applications;

    public StatsService(LandPlotRepository plots, CompetitionRepository competitions, ApplicationRepository applications) {
        this.plots = plots;
        this.competitions = competitions;
        this.applications = applications;
    }

    /** Public, anonymised figures — no personal data. */
    @Transactional(readOnly = true)
    public Map<String, Object> publicStats() {
        List<LandPlot> allPlots = plots.findAll();
        List<InvestmentApplication> apps = applications.findAll();
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("plotCount", allPlots.size());
        s.put("totalAreaHa", Math.round(allPlots.stream().mapToDouble(LandPlot::getAreaHa).sum()));
        s.put("openCompetitions", competitions.findByStatusOrderByDeadlineAsc(CompetitionStatus.PUBLISHED).stream().filter(Competition::isOpen).count());
        s.put("applicationCount", apps.size());
        s.put("plannedInvestment", apps.stream().mapToLong(InvestmentApplication::getPlannedInvestment).sum());
        s.put("plannedJobs", apps.stream().mapToInt(InvestmentApplication::getJobsCreated).sum());
        s.put("returneeJobs", apps.stream().mapToInt(InvestmentApplication::getReturneeJobs).sum());
        s.put("approvedCount", apps.stream().filter(a -> a.getStatus() == ApplicationStatus.APPROVED).count());
        s.put("decidedCount", apps.stream().filter(a -> a.getStatus().isFinal()).count());
        s.put("clearedPlots", allPlots.stream().filter(p -> p.getMineClearance() == MineClearanceStatus.CLEARED).count());
        s.put("byDistrict", count(allPlots, LandPlot::getDistrict));
        s.put("byActivity", count(allPlots, p -> p.getActivityType().getLabel()));
        s.put("applicationsByStatus", count(apps, a -> a.getStatus().getLabel()));
        s.put("investmentByDistrict", apps.stream().collect(Collectors.groupingBy(a -> a.getPlot().getDistrict(),
                TreeMap::new, Collectors.summingLong(InvestmentApplication::getPlannedInvestment))));
        return s;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        Map<String, Object> s = publicStats();
        List<InvestmentApplication> apps = applications.findAll();
        Map<String, Long> perDay = new TreeMap<>();
        LocalDate today = LocalDate.now();
        for (int i = 29; i >= 0; i--) perDay.put(today.minusDays(i).toString(), 0L);
        ZoneId zone = ZoneId.systemDefault();
        for (InvestmentApplication a : apps) {
            String day = a.getCreatedAt().atZone(zone).toLocalDate().toString();
            perDay.computeIfPresent(day, (k, v) -> v + 1);
        }
        s.put("applicationsPerDay", perDay);
        Map<String, Long> statusCodes = new LinkedHashMap<>();
        for (ApplicationStatus st : ApplicationStatus.values()) {
            statusCodes.put(st.name(), apps.stream().filter(a -> a.getStatus() == st).count());
        }
        s.put("statusCounts", statusCodes);
        s.put("pendingApprovalCompetitions", competitions.countByStatus(CompetitionStatus.PENDING_APPROVAL));
        s.put("averageAutoScore", Math.round(apps.stream().mapToInt(InvestmentApplication::getAutoScore).average().orElse(0)));
        s.put("ektisVerified", apps.stream().filter(a -> a.getEktisStatus() == EktisSyncStatus.VERIFIED).count());
        return s;
    }

    private static <T> Map<String, Long> count(Collection<T> items, Function<T, String> key) {
        return items.stream().collect(Collectors.groupingBy(key, TreeMap::new, Collectors.counting()));
    }
}
