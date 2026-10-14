package az.agro.portal.ai;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OnnxValue;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Crop recommendation. Runs the model trained on Kaggle (exported to ONNX) directly inside the JVM —
 * no Python service needed. If the model files are not installed yet, a transparent centroid-based
 * fallback is used and the response says so.
 */
@Service
public class CropRecommendationService {

    private static final Logger log = LoggerFactory.getLogger(CropRecommendationService.class);
    private static final String MODEL_FILE = "crop_model.onnx";
    private static final String META_FILE = "model_meta.json";

    private final Path modelDir;
    private final ObjectMapper json;
    private final OrtEnvironment env = OrtEnvironment.getEnvironment();

    private volatile LoadedModel model;

    private record LoadedModel(OrtSession session, String inputName, String probabilityOutput,
                               List<String> classes, String name, String version, Double testAccuracy,
                               Map<String, double[]> ranges, JsonNode meta) {
    }

    public CropRecommendationService(@Value("${app.model-dir}") String modelDir, ObjectMapper json) {
        this.modelDir = Path.of(modelDir).toAbsolutePath().normalize();
        this.json = json;
    }

    @PostConstruct
    public void init() {
        reload();
    }

    /** (Re)loads the model from disk — lets an admin drop in a newly trained model without a restart. */
    public synchronized boolean reload() {
        Path modelPath = modelDir.resolve(MODEL_FILE);
        Path metaPath = modelDir.resolve(META_FILE);
        if (!Files.exists(modelPath) || !Files.exists(metaPath)) {
            log.warn("AI model not found in {} — using fallback engine. Put {} and {} there.", modelDir, MODEL_FILE, META_FILE);
            close();
            return false;
        }
        try {
            JsonNode meta = json.readTree(metaPath.toFile());
            List<String> classes = new ArrayList<>();
            meta.path("classes").forEach(c -> classes.add(c.asText()));
            Map<String, double[]> ranges = new LinkedHashMap<>();
            meta.path("feature_ranges").fields().forEachRemaining(e ->
                    ranges.put(e.getKey(), new double[]{e.getValue().path("min").asDouble(), e.getValue().path("max").asDouble()}));
            OrtSession session = env.createSession(modelPath.toString(), new OrtSession.SessionOptions());
            String input = meta.path("input_name").asText(session.getInputNames().iterator().next());
            String probOut = meta.path("probability_output").asText("probabilities");
            JsonNode acc = meta.path("metrics").path("test_accuracy");
            LoadedModel loaded = new LoadedModel(session, input, probOut, classes,
                    meta.path("model_name").asText("model"), meta.path("version").asText("-"),
                    acc.isMissingNode() ? null : acc.asDouble(), ranges, meta);
            close();
            model = loaded;
            log.info("AI model loaded: {} v{} ({} classes, test accuracy {})", loaded.name(), loaded.version(), classes.size(), loaded.testAccuracy());
            return true;
        } catch (Exception e) {
            log.error("Failed to load AI model from {} — using fallback engine", modelDir, e);
            close();
            return false;
        }
    }

    public boolean isModelLoaded() {
        return model != null;
    }

    /** Model card for the UI / presentation. */
    public Map<String, Object> info() {
        Map<String, Object> info = new LinkedHashMap<>();
        LoadedModel m = model;
        info.put("modelLoaded", m != null);
        info.put("engine", m != null ? "ONNX Runtime (Java)" : "Fallback: centroid heuristic");
        info.put("modelDir", modelDir.toString());
        if (m != null) {
            info.put("modelName", m.name());
            info.put("version", m.version());
            info.put("features", m.meta().path("features"));
            info.put("classes", m.classes().size());
            info.put("metrics", m.meta().path("metrics"));
            info.put("featureImportance", m.meta().path("feature_importance"));
            info.put("modelComparison", m.meta().path("model_comparison"));
            info.put("dataset", m.meta().path("dataset").asText());
            info.put("trainedAt", m.meta().path("trained_at").asText());
        }
        return info;
    }

    public CropRecommendation recommend(SoilClimate input) {
        LoadedModel m = model;
        Map<String, Double> probabilities;
        List<String> outOfRange = new ArrayList<>();
        String engine;
        if (m != null) {
            try {
                probabilities = runOnnx(m, input);
                engine = "ONNX";
                double[] v = toDoubles(input.toVector());
                for (int i = 0; i < SoilClimate.FEATURES.length; i++) {
                    double[] r = m.ranges().get(SoilClimate.FEATURES[i]);
                    if (r != null && (v[i] < r[0] || v[i] > r[1])) outOfRange.add(SoilClimate.FEATURES[i]);
                }
            } catch (OrtException e) {
                log.error("ONNX inference failed, falling back", e);
                probabilities = runFallback(input);
                engine = "FALLBACK";
            }
        } else {
            probabilities = runFallback(input);
            engine = "FALLBACK";
        }
        return buildResult(m, engine, probabilities, outOfRange);
    }

    private Map<String, Double> runOnnx(LoadedModel m, SoilClimate input) throws OrtException {
        float[][] batch = {input.toVector()};
        try (OnnxTensor tensor = OnnxTensor.createTensor(env, batch);
             OrtSession.Result result = m.session().run(Map.of(m.inputName(), tensor))) {
            OnnxValue out = result.get(m.probabilityOutput()).orElseGet(() -> result.get(result.size() - 1));
            float[][] probs = (float[][]) out.getValue();
            Map<String, Double> map = new LinkedHashMap<>();
            for (int i = 0; i < m.classes().size(); i++) map.put(m.classes().get(i), (double) probs[0][i]);
            return map;
        }
    }

    /** Softmax over negative standardised distance to each crop's centroid. */
    private Map<String, Double> runFallback(SoilClimate input) {
        double[] x = toDoubles(input.toVector());
        double[] scale = {37, 33, 51, 5, 22, 0.8, 55}; // approx. feature std-devs of the dataset
        Map<String, Double> scores = new LinkedHashMap<>();
        double sum = 0;
        for (var e : CropCatalog.CENTROIDS.entrySet()) {
            double d = 0;
            for (int i = 0; i < x.length; i++) {
                double z = (x[i] - e.getValue()[i]) / scale[i];
                d += z * z;
            }
            double s = Math.exp(-d / 2);
            scores.put(e.getKey(), s);
            sum += s;
        }
        double total = sum == 0 ? 1 : sum;
        scores.replaceAll((k, v) -> v / total);
        return scores;
    }

    private CropRecommendation buildResult(LoadedModel m, String engine, Map<String, Double> probabilities, List<String> outOfRange) {
        List<CropRecommendation.CropScore> all = probabilities.entrySet().stream()
                .map(e -> new CropRecommendation.CropScore(e.getKey(), CropCatalog.nameAz(e.getKey()), e.getValue(),
                        CropCatalog.suitableForRegion(e.getKey())))
                .sorted(Comparator.comparingDouble(CropRecommendation.CropScore::probability).reversed())
                .toList();
        List<CropRecommendation.CropScore> rawTop = all.stream().limit(5).toList();

        double suitableSum = all.stream().filter(CropRecommendation.CropScore::regionSuitable)
                .mapToDouble(CropRecommendation.CropScore::probability).sum();
        List<CropRecommendation.CropScore> regional = all.stream()
                .filter(CropRecommendation.CropScore::regionSuitable)
                .map(c -> new CropRecommendation.CropScore(c.code(), c.name(),
                        suitableSum > 0 ? c.probability() / suitableSum : 0, true))
                .limit(3)
                .toList();

        StringBuilder why = new StringBuilder();
        if (!regional.isEmpty()) {
            why.append("Torpaq (N, P, K, pH) və iqlim (temperatur, rütubət, yağıntı) göstəricilərinə görə ən uyğun bitki: ")
                    .append(regional.get(0).name()).append(". ");
        }
        boolean filtered = rawTop.stream().anyMatch(c -> !c.regionSuitable());
        if (filtered) {
            why.append("Qarabağ iqlimi üçün real olmayan tropik bitkilər nəticədən çıxarılıb. ");
        }
        if (!outOfRange.isEmpty()) {
            why.append("Diqqət: bəzi göstəricilər modelin öyrəndiyi diapazondan kənardadır (")
                    .append(String.join(", ", outOfRange)).append("), nəticə daha az etibarlıdır. ");
        }
        if (m == null) {
            why.append("Öyrədilmiş model hələ quraşdırılmayıb — müvəqqəti evristik alqoritm işləyir.");
        }

        return new CropRecommendation(m != null && "ONNX".equals(engine), engine,
                m != null ? m.name() : "Centroid heuristic",
                m != null ? m.version() : "-",
                m != null ? m.testAccuracy() : null,
                regional, rawTop, outOfRange, why.toString().trim());
    }

    private static double[] toDoubles(float[] f) {
        double[] d = new double[f.length];
        for (int i = 0; i < f.length; i++) d[i] = f[i];
        return d;
    }

    @PreDestroy
    public synchronized void close() {
        LoadedModel m = model;
        model = null;
        if (m != null) {
            try {
                m.session().close();
            } catch (OrtException e) {
                log.warn("Error closing ONNX session", e);
            }
        }
    }
}
