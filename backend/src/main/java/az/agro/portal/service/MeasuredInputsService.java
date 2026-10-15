package az.agro.portal.service;

import az.agro.portal.ai.CropRecommendation;
import az.agro.portal.ai.CropRecommendationService;
import az.agro.portal.ai.SoilClimate;
import az.agro.portal.domain.LandPlot;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.web.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * Replaces the illustrative model inputs of a plot with measurements where a free open source exists:
 * growing-season (April–September) temperature, humidity and rainfall from ERA5 (Open-Meteo, 2020–2024) and topsoil
 * pH and total nitrogen from ISRIC SoilGrids (250 m). Phosphorus and potassium have no open map at this scale, so they
 * stay the plot's illustrative values, and every input is labelled with where it came from.
 */
@Service
public class MeasuredInputsService {

    private static final Logger log = LoggerFactory.getLogger(MeasuredInputsService.class);
    private static final int FROM = 2020, TO = 2024;

    public record Input(String key, String label, double value, String unit, boolean measured, String source) {}
    public record Report(Long plotId, List<Input> inputs, CropRecommendation recommendation, int measuredCount, String note) {}

    private final LandPlotRepository plots;
    private final CropRecommendationService ai;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final Map<Long, Report> cache = new ConcurrentHashMap<>();

    public MeasuredInputsService(LandPlotRepository plots, CropRecommendationService ai) {
        this.plots = plots;
        this.ai = ai;
    }

    public Report report(Long plotId) {
        Report c = cache.get(plotId);
        if (c != null) return c;
        LandPlot p = plots.findById(plotId).orElseThrow(() -> ApiException.notFound("Sahə"));

        double temp = p.getAvgTemperature(), hum = p.getHumidity(), rain = p.getRainfall(), ph = p.getPh();
        boolean climateOk = false, soilOk = false;
        Double soilN = null;
        try {
            double[] season = season(p.getLatitude(), p.getLongitude());
            temp = season[0];
            hum = season[1];
            rain = season[2];
            climateOk = true;
        } catch (Exception e) {
            log.warn("ERA5 season inputs failed for plot {}: {}", plotId, e.getMessage());
        }
        try {
            double[] soil = soil(p.getLatitude(), p.getLongitude());
            if (!Double.isNaN(soil[0])) { ph = soil[0]; soilOk = true; }
            if (!Double.isNaN(soil[1])) soilN = soil[1];
        } catch (Exception e) {
            log.warn("SoilGrids failed for plot {}: {}", plotId, e.getMessage());
        }

        String era5 = "ERA5 reanalizi, aprel–sentyabr " + FROM + "–" + TO + " ortalaması (Open-Meteo)";
        String soilGrids = "ISRIC SoilGrids 250 m, 0–5 sm qat";
        String illustrative = "İllüstrativ dəyər (torpaq analizi ilə əvəz olunmalıdır)";
        List<Input> inputs = new ArrayList<>();
        inputs.add(new Input("N", "Azot (N), model şkalası", p.getNitrogen(), "kq/ha", false, illustrative));
        inputs.add(new Input("P", "Fosfor (P)", p.getPhosphorus(), "kq/ha", false, illustrative));
        inputs.add(new Input("K", "Kalium (K)", p.getPotassium(), "kq/ha", false, illustrative));
        inputs.add(new Input("ph", "Torpağın pH-ı", round(ph, 1), "", soilOk, soilOk ? soilGrids : illustrative));
        inputs.add(new Input("temperature", "Orta temperatur (vegetasiya dövrü)", round(temp, 1), "°C", climateOk, climateOk ? era5 : illustrative));
        inputs.add(new Input("humidity", "Nisbi rütubət (vegetasiya dövrü)", round(hum, 0), "%", climateOk, climateOk ? era5 : illustrative));
        inputs.add(new Input("rainfall", "Yağıntı (aprel–sentyabr)", round(rain, 0), "mm", climateOk, climateOk ? era5 : illustrative));
        if (soilN != null) {
            // total N in g/kg is a different quantity from the model's N feature, so it is shown but not fed in
            inputs.add(new Input("soilN", "Ümumi azot (ölçü, modelə verilmir)", round(soilN, 2), "q/kq", true, soilGrids));
        }

        CropRecommendation rec = ai.recommend(new SoilClimate(p.getNitrogen(), p.getPhosphorus(), p.getPotassium(), temp, hum, ph, rain));
        int measured = (int) inputs.stream().filter(i -> i.measured() && !i.key().equals("soilN")).count();
        Report r = new Report(plotId, inputs, rec, measured,
                "Model 7 göstəricidən " + measured + "-ni real ölçü ilə alır. N, P və K üçün açıq xəritə yoxdur: sahədə torpaq analizi aparılmalıdır.");
        if (climateOk || soilOk) cache.put(plotId, r);
        return r;
    }

    /** Mean April–September temperature and humidity, and mean April–September rainfall per year. */
    private double[] season(double lat, double lon) throws Exception {
        String url = String.format(Locale.ROOT,
                "https://archive-api.open-meteo.com/v1/archive?latitude=%.4f&longitude=%.4f&start_date=%d-01-01&end_date=%d-12-31"
                        + "&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=Asia%%2FBaku", lat, lon, FROM, TO);
        JsonNode d = get(url, 60).path("daily");
        JsonNode time = d.path("time"), t = d.path("temperature_2m_mean"), h = d.path("relative_humidity_2m_mean"), pr = d.path("precipitation_sum");
        double st = 0, sh = 0, sp = 0;
        int nt = 0, nh = 0;
        for (int i = 0; i < time.size(); i++) {
            int m = LocalDate.parse(time.get(i).asText()).getMonthValue();
            if (m < 4 || m > 9) continue;
            if (!t.get(i).isNull()) { st += t.get(i).asDouble(); nt++; }
            if (!h.get(i).isNull()) { sh += h.get(i).asDouble(); nh++; }
            if (!pr.get(i).isNull()) sp += pr.get(i).asDouble();
        }
        if (nt == 0) throw new IllegalStateException("no ERA5 data");
        return new double[]{st / nt, nh == 0 ? Double.NaN : sh / nh, sp / (TO - FROM + 1)};
    }

    /** Topsoil (0–5 cm) pH in water and total nitrogen in g/kg; NaN where SoilGrids has no value (water, urban). */
    private double[] soil(double lat, double lon) throws Exception {
        String url = String.format(Locale.ROOT,
                "https://rest.isric.org/soilgrids/v2.0/properties/query?lon=%.5f&lat=%.5f&property=phh2o&property=nitrogen&depth=0-5cm&value=mean",
                lon, lat);
        double ph = Double.NaN, n = Double.NaN;
        for (JsonNode layer : get(url, 30).path("properties").path("layers")) {
            JsonNode mean = layer.path("depths").path(0).path("values").path("mean");
            if (mean.isMissingNode() || mean.isNull()) continue;
            double v = mean.asDouble() / layer.path("unit_measure").path("d_factor").asDouble(1);
            switch (layer.path("name").asText()) {
                case "phh2o" -> ph = v;
                case "nitrogen" -> n = v; // cg/kg divided by d_factor 100 = g/kg
                default -> { }
            }
        }
        return new double[]{ph, n};
    }

    private JsonNode get(String url, int timeoutSeconds) throws Exception {
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(timeoutSeconds)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
        return json.readTree(res.body());
    }

    private static double round(double v, int digits) {
        double f = Math.pow(10, digits);
        return Math.round(v * f) / f;
    }
}
