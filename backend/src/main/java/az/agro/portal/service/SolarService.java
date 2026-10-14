package az.agro.portal.service;

import az.agro.portal.domain.ActivityType;
import az.agro.portal.domain.LandPlot;
import az.agro.portal.domain.MineClearanceStatus;
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
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Solar suitability of a plot and the inputs for its economics.
 * <ul>
 *   <li>Solar resource: EU JRC PVGIS 5.3 (free, no key) for an optimally tilted fixed array at the plot centre.</li>
 *   <li>Tariffs: Tariff (Price) Council decision No. 19 of 29.12.2024, gapik/kWh incl. VAT: purchase of electricity
 *       from solar plants 8.5; retail tariff for industry and agriculture 10.6.</li>
 *   <li>Rules: an "active consumer" (Law on the use of renewable energy sources in electricity production, 2021, and
 *       the Cabinet of Ministers rules) may own a plant up to 150 kW and deliver the surplus to the Azerishiq grid;
 *       larger plants get their tariff through an auction.</li>
 * </ul>
 * Costs (AZN per kWp, O&M, degradation) are editable planning assumptions, not official figures.
 */
@Service
public class SolarService {

    private static final Logger log = LoggerFactory.getLogger(SolarService.class);

    public record Criterion(String name, int points, int max, String note) {}
    public record Rules(double sellTariff, double agriTariff, int activeConsumerKw, String tariffSource, String rulesSource) {}
    public record Assumptions(double capexSmallPerKwp, double capexLargePerKwp, double omShare, double degradation,
                              int lifetimeYears, double agrivoltaicKwpPerHa, double selfConsumption, double gridCo2KgPerKwh) {}
    public record Report(Long plotId, String verdict, String verdictCode, int score, List<Criterion> criteria,
                         double kwhPerKwp, double irradiation, int optimalTilt, double[] monthlyKwhPerKwp,
                         Rules rules, Assumptions assumptions, List<String> notes, String source) {}

    private static final Rules RULES = new Rules(0.085, 0.106, 150,
            "Tarif (Qiymət) Şurasının 29.12.2024-cü il tarixli 19 nömrəli qərarı (ƏDV daxil)",
            "«Elektrik enerjisinin istehsalında bərpa olunan enerji mənbələrindən istifadə haqqında» Qanun (2021) və aktiv istehlakçı qaydaları");

    private final LandPlotRepository plots;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final Map<Long, Report> cache = new ConcurrentHashMap<>();

    public SolarService(LandPlotRepository plots) {
        this.plots = plots;
    }

    public Report report(Long plotId) {
        Report cached = cache.get(plotId);
        if (cached != null) return cached;
        LandPlot p = plots.findById(plotId).orElseThrow(() -> ApiException.notFound("Sahə"));
        JsonNode pv;
        try {
            pv = pvgis(p.getLatitude(), p.getLongitude());
        } catch (Exception e) {
            log.warn("PVGIS failed for plot {}: {}", plotId, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Günəş radiasiyası xidməti (PVGIS) hazırda cavab vermir");
        }
        JsonNode totals = pv.path("outputs").path("totals").path("fixed");
        double yearly = totals.path("E_y").asDouble();
        double irradiation = totals.path("H(i)_y").asDouble();
        int tilt = pv.path("inputs").path("mounting_system").path("fixed").path("slope").path("value").asInt();
        double[] monthly = new double[12];
        for (JsonNode m : pv.path("outputs").path("monthly").path("fixed")) {
            int i = m.path("month").asInt() - 1;
            if (i >= 0 && i < 12) monthly[i] = round(m.path("E_m").asDouble(), 1);
        }
        Report r = assess(p, yearly, irradiation, tilt, monthly);
        cache.put(plotId, r);
        return r;
    }

    Report assess(LandPlot p, double yearly, double irradiation, int tilt, double[] monthly) {
        List<Criterion> c = new ArrayList<>();
        int sun = (int) Math.round(Math.max(0, Math.min(40, 20 + (yearly - 1100) / 250.0 * 20)));
        c.add(new Criterion("Günəş potensialı", sun, 40, Math.round(yearly) + " kWh/kWp ildə, optimal bucaq " + tilt + "°"));

        MineClearanceStatus mine = p.getMineClearance();
        int mines = mine == MineClearanceStatus.CLEARED ? 25 : mine == MineClearanceStatus.IN_PROGRESS ? 5 : 0;
        c.add(new Criterion("Minatəmizləmə", mines, 25, mine.getLabel()));

        int grid = p.isElectricityAvailable() ? 15 : p.getRoadKm() <= 2 ? 8 : 3;
        c.add(new Criterion("Şəbəkəyə qoşulma", grid, 15, p.isElectricityAvailable()
                ? "Sahədə elektrik xətti var"
                : "Elektrik xətti yoxdur, yola qədər " + round(p.getRoadKm(), 1) + " km: qoşulma xərci artır"));

        ActivityType a = p.getActivityType();
        int fit = switch (a) {
            case CROP_FARMING, LIVESTOCK, BEEKEEPING, GREENHOUSE -> 20;
            case HORTICULTURE, VITICULTURE -> 10;
        };
        c.add(new Criterion("Fəaliyyətlə uyğunluq", fit, 20, switch (a) {
            case CROP_FARMING -> "Aqrovoltaik: hündür konstruksiya altında əkin davam edir, suvarma nasosları günəşlə işləyir";
            case LIVESTOCK -> "Panellər altında otlaq və kölgə: heyvandarlıqla yaxşı uyğunlaşır";
            case BEEKEEPING -> "Panellər arası çiçəkli örtük arıçılığa uyğundur";
            case GREENHOUSE -> "İstixananın isitmə, işıqlandırma və suvarma yükü öz istehsalı ilə qarşılanır";
            case HORTICULTURE, VITICULTURE -> "Çoxillik bitkilər kölgəyə həssasdır: panellər yalnız sahənin kənarında";
        }));

        int score = c.stream().mapToInt(Criterion::points).sum();
        String code, verdict;
        if (mine != MineClearanceStatus.CLEARED) {
            code = "BLOCKED";
            verdict = "Hazırda uyğun deyil: minatəmizləmə başa çatmayıb";
        } else if (score >= 75) {
            code = "HIGH";
            verdict = "Günəş paneli üçün yüksək uyğunluq";
        } else if (score >= 55) {
            code = "GOOD";
            verdict = "Günəş paneli üçün uyğundur";
        } else {
            code = "LIMITED";
            verdict = "Uyğunluq məhduddur";
        }

        double self = switch (a) {
            case GREENHOUSE -> 0.7;
            case LIVESTOCK -> 0.5;
            case CROP_FARMING -> 0.35;
            case HORTICULTURE, VITICULTURE -> 0.3;
            case BEEKEEPING -> 0.1;
        };
        Assumptions as = new Assumptions(1350, 1050, 0.015, 0.005, 25, 450, self, 0.45);

        List<String> notes = List.of(
                "150 kW-a qədər qurğu «aktiv istehlakçı» kimi qoşulur: Azərişıq ilə müqavilə bağlanır, artıq enerji şəbəkəyə ötürülür.",
                "150 kW-dan böyük stansiyalar üçün alış tarifi Energetika Nazirliyinin keçirdiyi auksionla müəyyən edilir; hesabda 8.5 qəpik istinad tarifi götürülüb.",
                "Kənd təsərrüfatı təyinatlı torpaqda panellər əkini əvəz etmir: aqrovoltaik sxemdə sahə istifadəsi davam edir, icarə şərtlərinə uyğunluq komissiya ilə razılaşdırılır.",
                "Xərclər (₼/kWp, istismar, deqradasiya) planlaşdırma fərziyyələridir, kalkulyatorda dəyişdirilə bilər.");
        return new Report(p.getId(), verdict, code, score, c, round(yearly, 0), round(irradiation, 0), tilt, monthly,
                RULES, as, notes, "PVGIS 5.3, Avropa Komissiyası Birgə Tədqiqat Mərkəzi (JRC)");
    }

    private JsonNode pvgis(double lat, double lon) throws Exception {
        String url = String.format(Locale.ROOT,
                "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=%.5f&lon=%.5f&peakpower=1&loss=14&optimalangles=1&outputformat=json", lat, lon);
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(60)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw new IllegalStateException("PVGIS HTTP " + res.statusCode());
        return json.readTree(res.body());
    }

    private static double round(double v, int digits) {
        double f = Math.pow(10, digits);
        return Math.round(v * f) / f;
    }
}
