package az.agro.portal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Official statistics of the State Statistics Committee (azstat.gov.az open data API, CC0) and the ANAMA
 * certified-areas layer (opendata.az, ODC-BY). A snapshot is bundled so the portal works offline;
 * an administrator can refresh the statistics live from the official API.
 */
@Service
public class OfficialDataService {

    private static final Logger log = LoggerFactory.getLogger(OfficialDataService.class);

    /** Indicator metadata: key → [Azerbaijani label, unit]. Order = display order. */
    public static final Map<String, String[]> INDICATORS = new LinkedHashMap<>();

    static {
        INDICATORS.put("wheat_yield", new String[]{"Buğdanın məhsuldarlığı", "sent/ha"});
        INDICATORS.put("barley_yield", new String[]{"Arpanın məhsuldarlığı", "sent/ha"});
        INDICATORS.put("maize_yield", new String[]{"Dən üçün qarğıdalının məhsuldarlığı", "sent/ha"});
        INDICATORS.put("grain_yield", new String[]{"Dənli və dənli paxlalıların məhsuldarlığı", "sent/ha"});
        INDICATORS.put("chickpea_yield", new String[]{"Noxudun məhsuldarlığı", "sent/ha"});
        INDICATORS.put("lentil_yield", new String[]{"Mərciməyin məhsuldarlığı", "sent/ha"});
        INDICATORS.put("bean_yield", new String[]{"Lobyanın məhsuldarlığı", "sent/ha"});
        INDICATORS.put("grain_area", new String[]{"Dənli və dənli paxlalıların əkin sahəsi", "ha"});
        INDICATORS.put("fruit_prod", new String[]{"Meyvə və giləmeyvə istehsalı", "ton"});
        INDICATORS.put("potato_prod", new String[]{"Kartof istehsalı", "ton"});
        INDICATORS.put("watermelon_prod", new String[]{"Qarpız istehsalı", "ton"});
        INDICATORS.put("melon_prod", new String[]{"Yemiş istehsalı", "ton"});
    }

    /** Crop code of the AI model → indicator holding its yield, where an official one exists. */
    public static final Map<String, String> CROP_YIELD = Map.of(
            "maize", "maize_yield", "chickpea", "chickpea_yield", "lentil", "lentil_yield", "kidneybeans", "bean_yield");

    public record Point(int year, double value) {
    }

    public record IndicatorSummary(String key, String label, String unit, Integer year, Double district, Double national,
                                   Double region, List<Point> series) {
    }

    private final ObjectMapper json;
    /** key → unit name → year → value */
    private final Map<String, Map<String, TreeMap<Integer, Double>>> data = new ConcurrentHashMap<>();
    private volatile JsonNode sources;
    private volatile Instant refreshedAt;
    private volatile String refreshedFrom = "bundled snapshot";
    private byte[] anamaGeoJson;
    /** district → [certified areas, hectares, latest certification date] from the ANAMA layer */
    private final Map<String, Object[]> anamaByDistrict = new TreeMap<>();

    public OfficialDataService(ObjectMapper json) {
        this.json = json;
    }

    @PostConstruct
    void load() {
        try (InputStream in = new ClassPathResource("opendata/sources.json").getInputStream()) {
            sources = json.readTree(in);
        } catch (IOException e) {
            log.warn("No bundled opendata/sources.json");
            sources = json.createArrayNode();
        }
        for (String key : INDICATORS.keySet()) {
            try (InputStream in = new ClassPathResource("opendata/azstat/" + key + ".csv").getInputStream()) {
                data.put(key, parse(new String(in.readAllBytes(), StandardCharsets.UTF_8), true));
            } catch (IOException e) {
                log.warn("No bundled statistics for {}", key);
            }
        }
        try (InputStream in = new ClassPathResource("opendata/anama_agri.geojson").getInputStream()) {
            anamaGeoJson = in.readAllBytes();
        } catch (IOException e) {
            anamaGeoJson = "{\"type\":\"FeatureCollection\",\"features\":[]}".getBytes(StandardCharsets.UTF_8);
        }
        try {
            for (JsonNode f : json.readTree(anamaGeoJson).path("features")) {
                JsonNode p = f.path("properties");
                Object[] agg = anamaByDistrict.computeIfAbsent(p.path("district").asText(), k -> new Object[]{0, 0.0, ""});
                agg[0] = (Integer) agg[0] + 1;
                agg[1] = (Double) agg[1] + p.path("areaHa").asDouble();
                String end = p.path("end").asText("");
                if (end.compareTo((String) agg[2]) > 0) agg[2] = end;
            }
        } catch (IOException e) {
            log.warn("Could not summarise the ANAMA layer", e);
        }
        log.info("Official data loaded: {} indicators, ANAMA layer {} KB", data.size(), anamaGeoJson.length / 1024);
    }

    /** Parses either our compact CSV (year,unit,value) or the raw azstat CSV (5 columns). */
    private static Map<String, TreeMap<Integer, Double>> parse(String csv, boolean compact) {
        Map<String, TreeMap<Integer, Double>> out = new HashMap<>();
        String[] lines = csv.replace("﻿", "").split("\\r?\\n");
        for (int i = 1; i < lines.length; i++) {
            List<String> c = splitCsv(lines[i]);
            if (c.size() < 3) continue;
            String unit = compact ? c.get(1) : c.get(2);
            String raw = compact ? c.get(2) : c.get(4);
            if (raw == null || raw.isBlank() || raw.equals("Null")) continue;
            try {
                out.computeIfAbsent(unit, k -> new TreeMap<>()).put(Integer.parseInt(c.get(0).trim()), Double.parseDouble(raw));
            } catch (NumberFormatException ignored) {
                // header repeats or footnotes
            }
        }
        return out;
    }

    private static List<String> splitCsv(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean q = false;
        for (char ch : line.toCharArray()) {
            if (ch == '"') q = !q;
            else if (ch == ',' && !q) {
                cells.add(cur.toString());
                cur.setLength(0);
            } else cur.append(ch);
        }
        cells.add(cur.toString());
        return cells;
    }

    private static String unitOf(String district) {
        return district.equals("Xankəndi") ? "Xankəndi şəhəri" : district + " rayonu";
    }

    public Optional<Double> latest(String key, String unit) {
        return Optional.ofNullable(data.get(key)).map(m -> m.get(unit)).filter(m -> !m.isEmpty()).map(m -> m.lastEntry().getValue());
    }

    /**
     * Official yield (t/ha) of a crop: the median of the last five reported years, so one drought or bumper year does
     * not set the business plan. District first, then the Karabakh region, then the national figure.
     */
    public Optional<Map<String, Object>> cropYield(String crop, String district) {
        String key = CROP_YIELD.get(crop);
        if (key == null || !data.containsKey(key)) return Optional.empty();
        Map<String, TreeMap<Integer, Double>> m = data.get(key);
        for (String unit : List.of(unitOf(district), "Qarabağ iqtisadi rayonu", "Azərbaycan Respublikası")) {
            TreeMap<Integer, Double> s = m.get(unit);
            if (s != null && !s.isEmpty()) {
                Map<String, Object> r = new LinkedHashMap<>();
                List<Double> last5 = new ArrayList<>(s.tailMap(s.lastKey() - 4, true).values());
                Collections.sort(last5);
                int n = last5.size();
                double median = n % 2 == 1 ? last5.get(n / 2) : (last5.get(n / 2 - 1) + last5.get(n / 2)) / 2;
                int fromYear = s.tailMap(s.lastKey() - 4, true).firstKey();
                r.put("tonsPerHa", Math.round(median / 10 * 100) / 100.0);
                r.put("year", s.lastKey());
                r.put("fromYear", fromYear);
                r.put("years", n);
                // Before the 2020 liberation the district figures describe only the part under Azerbaijani control.
                if (fromYear <= 2020 && unit.endsWith("rayonu")) {
                    r.put("note", "2020-ci ilədək rayon göstəriciləri yalnız işğal altında olmayan hissəni əks etdirir");
                }
                r.put("unit", unit);
                r.put("source", "Dövlət Statistika Komitəsi, " + INDICATORS.get(key)[0]);
                return Optional.of(r);
            }
        }
        return Optional.empty();
    }

    public List<IndicatorSummary> district(String district) {
        String unit = unitOf(district);
        List<IndicatorSummary> out = new ArrayList<>();
        for (var e : INDICATORS.entrySet()) {
            Map<String, TreeMap<Integer, Double>> m = data.getOrDefault(e.getKey(), Map.of());
            TreeMap<Integer, Double> s = m.get(unit);
            if (s == null || s.isEmpty()) continue;
            int year = s.lastKey();
            List<Point> series = s.tailMap(year - 9, true).entrySet().stream().map(p -> new Point(p.getKey(), p.getValue())).toList();
            out.add(new IndicatorSummary(e.getKey(), e.getValue()[0], e.getValue()[1], year, s.get(year),
                    valueAt(m, "Azərbaycan Respublikası", year), valueAt(m, "Qarabağ iqtisadi rayonu", year), series));
        }
        return out;
    }

    private static Double valueAt(Map<String, TreeMap<Integer, Double>> m, String unit, int year) {
        TreeMap<Integer, Double> s = m.get(unit);
        return s == null ? null : s.get(year);
    }

    public Map<String, Object> sources() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("datasets", sources);
        m.put("statisticsRefreshedAt", refreshedAt);
        m.put("statisticsFrom", refreshedFrom);
        return m;
    }

    /** ANAMA agricultural cleared areas per district: count, hectares, latest certification date. */
    public Map<String, Object[]> anamaSummary() {
        return anamaByDistrict;
    }

    public byte[] anamaLayer() {
        return anamaGeoJson;
    }

    /** Re-downloads every statistics table from the official azstat API listed in sources.json. */
    public synchronized Map<String, Object> refresh() {
        RestClient http = RestClient.builder().defaultHeader("User-Agent", "AqrarInvest/0.1").build();
        Map<String, Object> result = new LinkedHashMap<>();
        int ok = 0;
        for (JsonNode s : sources) {
            String key = s.path("key").asText();
            if (!INDICATORS.containsKey(key)) continue;
            try {
                String csv = http.get().uri(s.path("api").asText()).retrieve().body(String.class);
                Map<String, TreeMap<Integer, Double>> parsed = parse(csv == null ? "" : csv, false);
                if (!parsed.isEmpty()) {
                    data.put(key, parsed);
                    ok++;
                }
                result.put(key, parsed.size() + " vahid");
            } catch (Exception e) {
                result.put(key, "xəta: " + e.getClass().getSimpleName());
            }
        }
        if (ok > 0) {
            refreshedAt = Instant.now();
            refreshedFrom = "azstat.gov.az (canlı)";
        }
        result.put("updated", ok);
        return result;
    }
}
