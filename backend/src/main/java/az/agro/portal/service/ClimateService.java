package az.agro.portal.service;

import az.agro.portal.ai.CropCatalog;
import az.agro.portal.ai.CropRecommendation;
import az.agro.portal.domain.LandPlot;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.web.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ten-year climate of a plot and what it means for the crops the AI recommends.
 * Daily ERA5 reanalysis (2015–2024) from the Open-Meteo historical API (free, no key) at the plot's coordinates:
 * frost, late spring frost, the coldest night, heat days, rainfall and the irrigation the season needs.
 * Crop limits are general agronomic reference values (frost hardiness, heat stress, seasonal water need), not
 * variety-specific; they turn the statistics into a plain low / medium / high risk per crop.
 */
@Service
public class ClimateService {

    private static final Logger log = LoggerFactory.getLogger(ClimateService.class);
    private static final int FROM = 2015, TO = 2024;

    /** winterKill °C (perennials only, null = annual), late-frost sensitive, heat limit °C, seasonal water need mm. */
    record Limits(Double winterKill, boolean lateFrost, double heat, double water) {}

    static final Map<String, Limits> LIMITS = Map.ofEntries(
            Map.entry("apple", new Limits(-30.0, true, 35, 700)),
            Map.entry("grapes", new Limits(-20.0, true, 40, 600)),
            Map.entry("pomegranate", new Limits(-12.0, true, 42, 650)),
            Map.entry("cotton", new Limits(null, true, 40, 700)),
            Map.entry("maize", new Limits(null, true, 38, 600)),
            Map.entry("rice", new Limits(null, true, 38, 1100)),
            Map.entry("watermelon", new Limits(null, true, 40, 450)),
            Map.entry("muskmelon", new Limits(null, true, 40, 450)),
            Map.entry("kidneybeans", new Limits(null, true, 35, 400)),
            Map.entry("mungbean", new Limits(null, true, 40, 350)),
            Map.entry("chickpea", new Limits(null, false, 35, 350)),
            Map.entry("lentil", new Limits(null, false, 33, 300)));

    public record Month(int month, double tmax, double tmin, double precip) {}
    public record Indicators(double frostDays, double lateFrostDays, int yearsWithLateFrost, double coldestNight,
                             double avgYearlyMin, double hotDays35, double annualPrecip, double seasonPrecip,
                             double driestSummer, double gdd10) {}
    public record Risk(String factor, String level, String note) {}
    public record CropRisk(String code, String name, String overall, double irrigationNeedMm, List<Risk> risks) {}
    public record Report(Long plotId, String period, double elevation, Indicators indicators, List<Month> months,
                         List<CropRisk> crops, String source, String note) {}

    private final LandPlotRepository plots;
    private final PlotService plotService;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final Map<Long, Report> cache = new ConcurrentHashMap<>();

    public ClimateService(LandPlotRepository plots, PlotService plotService) {
        this.plots = plots;
        this.plotService = plotService;
    }

    public Report report(Long plotId) {
        Report c = cache.get(plotId);
        if (c != null) return c;
        LandPlot p = plots.findById(plotId).orElseThrow(() -> ApiException.notFound("Sahə"));
        JsonNode d;
        try {
            d = fetch(p.getLatitude(), p.getLongitude());
        } catch (Exception e) {
            log.warn("Open-Meteo failed for plot {}: {}", plotId, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "İqlim məlumatı xidməti (Open-Meteo) hazırda cavab vermir");
        }
        JsonNode daily = d.path("daily");
        List<LocalDate> days = new ArrayList<>();
        daily.path("time").forEach(t -> days.add(LocalDate.parse(t.asText())));
        double[] tmax = values(daily.path("temperature_2m_max")), tmin = values(daily.path("temperature_2m_min")), pr = values(daily.path("precipitation_sum"));

        Indicators ind = indicators(days, tmax, tmin, pr);
        List<Month> months = months(days, tmax, tmin, pr);

        CropRecommendation rec = plotService.recommendation(plotId);
        List<String> codes = new ArrayList<>();
        rec.recommendations().stream().limit(3).forEach(s -> codes.add(s.code()));
        List<CropRisk> crops = codes.stream().filter(LIMITS::containsKey)
                .map(code -> cropRisk(code, days, tmax, tmin, pr, ind, p.isIrrigationAvailable())).toList();

        Report r = new Report(plotId, FROM + "–" + TO, d.path("elevation").asDouble(), ind, months, crops,
                "ERA5 reanalizi (ECMWF / Copernicus), Open-Meteo tarixi hava API-si vasitəsilə",
                "Bitkilərin dözümlülük həddləri ümumi aqronomik istinad dəyərləridir; sort və mikroiqlimdən asılı olaraq dəyişir.");
        cache.put(plotId, r);
        return r;
    }

    static Indicators indicators(List<LocalDate> days, double[] tmax, double[] tmin, double[] pr) {
        int years = TO - FROM + 1;
        int frost = 0, late = 0, hot = 0;
        Set<Integer> lateYears = new HashSet<>();
        double coldest = Double.MAX_VALUE, gdd = 0, total = 0, season = 0;
        Map<Integer, Double> yearMin = new HashMap<>(), summer = new HashMap<>();
        for (int i = 0; i < days.size(); i++) {
            LocalDate day = days.get(i);
            if (Double.isNaN(tmin[i]) || Double.isNaN(tmax[i])) continue;
            int m = day.getMonthValue();
            if (tmin[i] < 0) frost++;
            boolean lateWindow = (m == 4) || (m == 5 && day.getDayOfMonth() <= 15);
            if (lateWindow && tmin[i] < 0) { late++; lateYears.add(day.getYear()); }
            if (tmax[i] >= 35) hot++;
            coldest = Math.min(coldest, tmin[i]);
            yearMin.merge(day.getYear(), tmin[i], Math::min);
            gdd += Math.max(0, (tmax[i] + tmin[i]) / 2 - 10);
            double p = Double.isNaN(pr[i]) ? 0 : pr[i];
            total += p;
            if (m >= 4 && m <= 9) season += p;
            if (m >= 6 && m <= 8) summer.merge(day.getYear(), p, Double::sum);
        }
        double avgYearlyMin = yearMin.values().stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double driest = summer.values().stream().mapToDouble(Double::doubleValue).min().orElse(0);
        return new Indicators(r1(frost / (double) years), r1(late / (double) years), lateYears.size(), r1(coldest),
                r1(avgYearlyMin), r1(hot / (double) years), r0(total / years), r0(season / years), r0(driest), r0(gdd / years));
    }

    static CropRisk cropRisk(String code, List<LocalDate> days, double[] tmax, double[] tmin, double[] pr, Indicators ind, boolean irrigation) {
        Limits l = LIMITS.get(code);
        int years = TO - FROM + 1;
        List<Risk> risks = new ArrayList<>();
        if (l.winterKill() != null) {
            double margin = ind.coldestNight() - l.winterKill();
            String level = margin <= 0 ? "HIGH" : margin < 4 ? "MEDIUM" : "LOW";
            risks.add(new Risk("Qış şaxtası", level, "10 ilin ən soyuq gecəsi " + fmt(ind.coldestNight()) + "°C, bitkinin zərər həddi " + fmt(l.winterKill()) + "°C"));
        }
        if (l.lateFrost()) {
            int y = ind.yearsWithLateFrost();
            String level = y >= 4 ? "HIGH" : y >= 1 ? "MEDIUM" : "LOW";
            risks.add(new Risk("Gec yaz şaxtası", level, "10 ilin " + y + "-də aprel–may ortasında şaxta olub (çiçəkləmə və cücərmə dövrü)"));
        }
        int hot = 0;
        for (int i = 0; i < tmax.length; i++) if (!Double.isNaN(tmax[i]) && tmax[i] >= l.heat()) hot++;
        double hotPerYear = hot / (double) years;
        risks.add(new Risk("İstilik stresi", hotPerYear > 10 ? "HIGH" : hotPerYear > 3 ? "MEDIUM" : "LOW",
                "İldə orta hesabla " + fmt(hotPerYear) + " gün " + fmt(l.heat()) + "°C-dən isti"));
        double need = Math.max(0, l.water() - 0.8 * ind.seasonPrecip());
        String wl = need <= 150 ? "LOW" : irrigation ? "MEDIUM" : "HIGH";
        risks.add(new Risk("Su ehtiyacı", wl, "Mövsümdə " + fmt(l.water()) + " mm lazımdır, yağış " + fmt(ind.seasonPrecip())
                + " mm verir: suvarma " + Math.round(need) + " mm" + (irrigation ? " (sahədə suvarma sistemi var)" : " (sahədə suvarma sistemi yoxdur)")));
        String overall = risks.stream().anyMatch(r -> r.level().equals("HIGH")) ? "HIGH"
                : risks.stream().filter(r -> r.level().equals("MEDIUM")).count() >= 2 ? "MEDIUM" : "LOW";
        return new CropRisk(code, CropCatalog.nameAz(code), overall, Math.round(need), risks);
    }

    static List<Month> months(List<LocalDate> days, double[] tmax, double[] tmin, double[] pr) {
        double[] sx = new double[12], sn = new double[12], sp = new double[12];
        int[] n = new int[12];
        for (int i = 0; i < days.size(); i++) {
            if (Double.isNaN(tmax[i]) || Double.isNaN(tmin[i])) continue;
            int m = days.get(i).getMonthValue() - 1;
            sx[m] += tmax[i]; sn[m] += tmin[i]; sp[m] += Double.isNaN(pr[i]) ? 0 : pr[i]; n[m]++;
        }
        int years = TO - FROM + 1;
        List<Month> out = new ArrayList<>();
        for (int m = 0; m < 12; m++) out.add(new Month(m + 1, r1(sx[m] / Math.max(1, n[m])), r1(sn[m] / Math.max(1, n[m])), r0(sp[m] / years)));
        return out;
    }

    private JsonNode fetch(double lat, double lon) throws Exception {
        String url = String.format(Locale.ROOT,
                "https://archive-api.open-meteo.com/v1/archive?latitude=%.4f&longitude=%.4f&start_date=%d-01-01&end_date=%d-12-31"
                        + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%%2FBaku", lat, lon, FROM, TO);
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(60)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
        return json.readTree(res.body());
    }

    private static double[] values(JsonNode arr) {
        double[] v = new double[arr.size()];
        for (int i = 0; i < v.length; i++) v[i] = arr.get(i).isNull() ? Double.NaN : arr.get(i).asDouble();
        return v;
    }

    private static double r1(double v) { return Math.round(v * 10) / 10.0; }
    private static double r0(double v) { return Math.round(v); }
    private static String fmt(double v) { return v == Math.rint(v) ? String.valueOf((long) v) : String.format(Locale.ROOT, "%.1f", v); }
}
