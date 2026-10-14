package az.agro.portal.service;

import az.agro.portal.domain.ApplicationStatus;
import az.agro.portal.domain.InvestmentApplication;
import az.agro.portal.domain.LandPlot;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.web.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Satellite check of a plot: monthly Sentinel-2 L2A NDVI averaged over the plot's official boundary.
 * Source: Microsoft Planetary Computer (open STAC catalogue and data API, no key; Copernicus Sentinel data, free and open).
 * For an awarded plot the trend after the award date is compared with the season: a plot that stays bare
 * six months after the award raises a monitoring alert, independent of the investor's own photo reports.
 */
@Service
public class SatelliteService {

    private static final Logger log = LoggerFactory.getLogger(SatelliteService.class);
    private static final String STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
    private static final String DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item";
    private static final String NDVI = "(B08-B04)/(B08+B04)";
    private static final Duration CACHE_TTL = Duration.ofHours(12);

    public record Observation(String date, String item, double cloud, double ndvi, double vegetatedShare) {}
    public record Report(Long plotId, String status, String headline, String message, Double latestNdvi,
                         String awardDate, List<Observation> series, Map<String, String> images, String source,
                         Instant checkedAt) {}

    private record Cached(Report report, Instant at) {}

    private final LandPlotRepository plots;
    private final ApplicationRepository applications;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();
    private final Map<Long, Cached> cache = new ConcurrentHashMap<>();

    public SatelliteService(LandPlotRepository plots, ApplicationRepository applications) {
        this.plots = plots;
        this.applications = applications;
    }

    @Transactional(readOnly = true)
    public Report report(Long plotId) {
        Cached c = cache.get(plotId);
        if (c != null && c.at().plus(CACHE_TTL).isAfter(Instant.now())) return c.report();
        LandPlot plot = plots.findById(plotId).orElseThrow(() -> ApiException.notFound("Sahə"));
        if (plot.getBoundaryGeoJson() == null) throw ApiException.badRequest("Sahənin sərhədi yoxdur");
        LocalDate award = applications.findAllByOrderByCreatedAtDesc().stream()
                .filter(a -> a.getPlot().getId().equals(plotId) && a.getStatus() == ApplicationStatus.APPROVED)
                .map(SatelliteService::decidedAt).map(i -> i.atZone(ZoneOffset.UTC).toLocalDate())
                .findFirst().orElse(null);
        try {
            Report r = build(plot, award);
            cache.put(plotId, new Cached(r, Instant.now()));
            return r;
        } catch (Exception e) {
            log.warn("Satellite check failed for plot {}: {}", plotId, e.getMessage());
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Peyk məlumat xidməti hazırda cavab vermir, bir az sonra yenidən cəhd edin");
        }
    }

    private static Instant decidedAt(InvestmentApplication a) {
        return a.getHistory().stream().filter(h -> h.getToStatus() == ApplicationStatus.APPROVED)
                .map(az.agro.portal.domain.StatusChange::getChangedAt).max(Comparator.naturalOrder()).orElse(a.getUpdatedAt());
    }

    private Report build(LandPlot plot, LocalDate award) throws Exception {
        JsonNode geometry = json.readTree(plot.getBoundaryGeoJson());
        LocalDate to = LocalDate.now(ZoneOffset.UTC);
        LocalDate from = to.minusMonths(13).withDayOfMonth(1);

        // 1. scenes over the plot, least cloudy per month
        ObjectNode search = json.createObjectNode();
        search.putArray("collections").add("sentinel-2-l2a");
        search.set("intersects", geometry);
        search.put("datetime", from + "T00:00:00Z/" + to + "T23:59:59Z");
        search.putObject("query").putObject("eo:cloud_cover").put("lt", 25);
        search.put("limit", 200);
        JsonNode found = post(STAC, search.toString());
        Map<YearMonth, JsonNode> best = new TreeMap<>();
        for (JsonNode f : found.path("features")) {
            YearMonth ym = YearMonth.from(LocalDate.parse(f.path("properties").path("datetime").asText().substring(0, 10)));
            JsonNode cur = best.get(ym);
            if (cur == null || cloud(f) < cloud(cur)) best.put(ym, f);
        }

        // 2. NDVI statistics over the boundary, months in parallel
        ObjectNode feature = json.createObjectNode().put("type", "Feature");
        feature.putObject("properties");
        feature.set("geometry", geometry);
        String body = feature.toString();
        List<Future<Observation>> jobs = new ArrayList<>();
        for (JsonNode f : best.values()) jobs.add(pool.submit(() -> observe(f, body)));
        List<Observation> series = new ArrayList<>();
        for (Future<Observation> j : jobs) {
            try {
                Observation o = j.get();
                if (o != null) series.add(o);
            } catch (Exception e) {
                log.debug("NDVI sample skipped: {}", e.getMessage());
            }
        }
        series.sort(Comparator.comparing(Observation::date));
        if (series.isEmpty()) {
            return new Report(plot.getId(), "NO_DATA", "Buludsuz peyk görüntüsü tapılmadı",
                    "Son 13 ayda sahə üzərində buludluluğu 25%-dən az olan Sentinel-2 görüntüsü yoxdur.",
                    null, award == null ? null : award.toString(), series, Map.of(), source(), Instant.now());
        }

        Observation last = series.get(series.size() - 1);
        String[] verdict = assess(series, award, to);
        return new Report(plot.getId(), verdict[0], verdict[1], verdict[2], round(last.ndvi()),
                award == null ? null : award.toString(), series, images(geometry, last.item()), source(), Instant.now());
    }

    private Observation observe(JsonNode scene, String featureBody) throws Exception {
        String item = scene.path("id").asText();
        String url = DATA + "/statistics?collection=sentinel-2-l2a&item=" + enc(item)
                + "&expression=" + enc(NDVI) + "&asset_as_band=true&max_size=512&histogram_bins=-1,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,1";
        JsonNode stats = post(url, featureBody).path("properties").path("statistics");
        JsonNode s = stats.elements().hasNext() ? stats.elements().next() : null;
        if (s == null || !s.has("mean") || s.path("count").asDouble() == 0) return null;
        // share of pixels with NDVI >= 0.3 (green vegetation)
        double vegetated = 0, total = 0;
        JsonNode counts = s.path("histogram").path(0), edges = s.path("histogram").path(1);
        for (int i = 0; i < counts.size(); i++) {
            total += counts.get(i).asDouble();
            if (edges.get(i).asDouble() >= 0.3 - 1e-9) vegetated += counts.get(i).asDouble();
        }
        String date = scene.path("properties").path("datetime").asText().substring(0, 10);
        return new Observation(date, item, round(cloud(scene)), round(s.path("mean").asDouble()),
                total == 0 ? 0 : round(vegetated / total));
    }

    /** status, headline, explanation */
    static String[] assess(List<Observation> series, LocalDate award, LocalDate today) {
        Observation last = series.get(series.size() - 1);
        double peak = series.stream().mapToDouble(Observation::ndvi).max().orElse(0);
        if (award == null) {
            String state = last.ndvi() >= 0.35 ? "bitki örtüyü sıxdır" : last.ndvi() >= 0.2 ? "seyrək bitki örtüyü var" : "torpaq əsasən boşdur";
            return new String[]{"BASELINE", "İlkin vəziyyət: " + state,
                    "Sahə hələ investora verilməyib. Bu göstəricilər müsabiqədən sonrakı monitorinq üçün başlanğıc nöqtəsidir (son 13 ayda ən yüksək NDVI " + fmt(peak) + ")."};
        }
        List<Observation> after = series.stream().filter(o -> !LocalDate.parse(o.date()).isBefore(award)).toList();
        List<Observation> before = series.stream().filter(o -> LocalDate.parse(o.date()).isBefore(award)).toList();
        double beforePeak = before.stream().mapToDouble(Observation::ndvi).max().orElse(0);
        double afterPeak = after.stream().mapToDouble(Observation::ndvi).max().orElse(0);
        long months = Period.between(award, today).toTotalMonths();
        if (after.isEmpty()) {
            return new String[]{"PENDING", "Qərardan sonra hələ görüntü yoxdur",
                    "Sahə " + award + " tarixində verilib. Növbəti buludsuz görüntü gələn kimi müqayisə ediləcək."};
        }
        if (afterPeak >= 0.35 || (afterPeak >= 0.25 && afterPeak > beforePeak + 0.08)) {
            return new String[]{"ACTIVE", "Sahədə əkin aşkarlanır",
                    "Qərardan sonra NDVI " + fmt(afterPeak) + " səviyyəsinə çatıb (qərardan əvvəl ən yüksək " + fmt(beforePeak) + "). Peyk məlumatı investorun hesabatlarını təsdiqləyir."};
        }
        if (months >= 6) {
            return new String[]{"ALERT", "Torpaq verildi, amma " + months + " aydır boş görünür",
                    "Qərardan sonra NDVI " + fmt(afterPeak) + "-dən yuxarı qalxmayıb: sahədə yaşıl bitki örtüyü yoxdur. Monitorinq üzrə mütəxəssisin yerində yoxlaması tövsiyə olunur."};
        }
        return new String[]{"WATCH", "Əkin hələ görünmür",
                "Qərardan " + months + " ay keçib, NDVI " + fmt(afterPeak) + ". 6 aya qədər əkin görünməsə, xəbərdarlıq yaranacaq."};
    }

    private Map<String, String> images(JsonNode geometry, String item) {
        double[] b = bbox(geometry);
        // pad the box a little so the boundary is visible in context
        double px = (b[2] - b[0]) * 0.15, py = (b[3] - b[1]) * 0.15;
        String box = String.format(Locale.ROOT, "%.5f,%.5f,%.5f,%.5f", b[0] - px, b[1] - py, b[2] + px, b[3] + py);
        String base = DATA + "/bbox/" + box + ".png?collection=sentinel-2-l2a&item=" + enc(item) + "&max_size=640";
        return Map.of(
                "trueColor", base + "&assets=visual&asset_bidx=" + enc("visual|1,2,3"),
                "ndvi", base + "&expression=" + enc(NDVI) + "&asset_as_band=true&rescale=" + enc("-0.1,0.8") + "&colormap_name=rdylgn",
                "bbox", box);
    }

    private static double[] bbox(JsonNode geometry) {
        double[] b = {180, 90, -180, -90};
        walk(geometry.path("coordinates"), b);
        return b;
    }

    private static void walk(JsonNode n, double[] b) {
        if (n.isArray() && n.size() >= 2 && n.get(0).isNumber()) {
            b[0] = Math.min(b[0], n.get(0).asDouble());
            b[1] = Math.min(b[1], n.get(1).asDouble());
            b[2] = Math.max(b[2], n.get(0).asDouble());
            b[3] = Math.max(b[3], n.get(1).asDouble());
        } else if (n.isArray()) n.forEach(c -> walk(c, b));
    }

    private JsonNode post(String url, String body) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() / 100 != 2) throw new IllegalStateException("HTTP " + res.statusCode() + " " + url);
        return json.readTree(res.body());
    }

    private static double cloud(JsonNode scene) {
        return scene.path("properties").path("eo:cloud_cover").asDouble(100);
    }

    private static String source() {
        return "Copernicus Sentinel-2 L2A (ESA), Microsoft Planetary Computer vasitəsilə";
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }

    private static String fmt(double v) {
        return String.format(Locale.ROOT, "%.2f", v);
    }

}
