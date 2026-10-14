package az.agro.portal.ai;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Domain knowledge layered on top of the ML model: Azerbaijani crop names, and which crops are
 * not realistic for Karabakh's climate (the Kaggle dataset comes from India and includes tropical crops).
 */
public final class CropCatalog {

    private CropCatalog() {
    }

    private static final Map<String, String> NAMES_AZ = Map.ofEntries(
            Map.entry("rice", "Düyü"),
            Map.entry("maize", "Qarğıdalı"),
            Map.entry("chickpea", "Noxud"),
            Map.entry("kidneybeans", "Lobya"),
            Map.entry("pigeonpeas", "Göyərçin noxudu"),
            Map.entry("mothbeans", "Mat lobyası"),
            Map.entry("mungbean", "Maş"),
            Map.entry("blackgram", "Qara maş"),
            Map.entry("lentil", "Mərcimək"),
            Map.entry("pomegranate", "Nar"),
            Map.entry("banana", "Banan"),
            Map.entry("mango", "Manqo"),
            Map.entry("grapes", "Üzüm"),
            Map.entry("watermelon", "Qarpız"),
            Map.entry("muskmelon", "Yemiş"),
            Map.entry("apple", "Alma"),
            Map.entry("orange", "Portağal"),
            Map.entry("papaya", "Papaya"),
            Map.entry("coconut", "Kokos"),
            Map.entry("cotton", "Pambıq"),
            Map.entry("jute", "Cut"),
            Map.entry("coffee", "Qəhvə"));

    /** Tropical / subtropical crops that are not commercially viable in the Karabakh economic region. */
    private static final Set<String> NOT_SUITABLE_FOR_REGION = Set.of(
            "banana", "mango", "coconut", "papaya", "coffee", "jute", "orange", "pigeonpeas", "mothbeans", "blackgram");

    public static String nameAz(String crop) {
        return NAMES_AZ.getOrDefault(key(crop), crop);
    }

    public static boolean suitableForRegion(String crop) {
        return !NOT_SUITABLE_FOR_REGION.contains(key(crop));
    }

    public static Map<String, String> all() {
        Map<String, String> sorted = new LinkedHashMap<>();
        NAMES_AZ.entrySet().stream()
                .filter(e -> suitableForRegion(e.getKey()))
                .sorted(Map.Entry.comparingByValue())
                .forEach(e -> sorted.put(e.getKey(), e.getValue()));
        return sorted;
    }

    private static String key(String crop) {
        return crop == null ? "" : crop.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Approximate per-class feature means of the Kaggle dataset (N, P, K, temp, humidity, pH, rainfall).
     * Used only by the fallback engine while the trained ONNX model is not installed.
     */
    static final Map<String, double[]> CENTROIDS = Map.ofEntries(
            Map.entry("rice", new double[]{80, 48, 40, 23.7, 82, 6.4, 236}),
            Map.entry("maize", new double[]{78, 48, 20, 22.4, 65, 6.2, 85}),
            Map.entry("chickpea", new double[]{40, 68, 80, 18.9, 17, 7.3, 80}),
            Map.entry("kidneybeans", new double[]{21, 67, 20, 20.1, 22, 5.7, 106}),
            Map.entry("pigeonpeas", new double[]{21, 68, 20, 27.7, 48, 5.8, 149}),
            Map.entry("mothbeans", new double[]{21, 48, 20, 28.2, 53, 6.8, 51}),
            Map.entry("mungbean", new double[]{21, 47, 20, 28.5, 86, 6.7, 48}),
            Map.entry("blackgram", new double[]{40, 67, 19, 30, 65, 7.1, 68}),
            Map.entry("lentil", new double[]{19, 68, 19, 24.5, 65, 6.9, 46}),
            Map.entry("pomegranate", new double[]{19, 19, 40, 21.8, 90, 6.4, 107}),
            Map.entry("banana", new double[]{100, 82, 50, 27.4, 80, 6.0, 105}),
            Map.entry("mango", new double[]{20, 27, 30, 31.2, 50, 5.8, 95}),
            Map.entry("grapes", new double[]{23, 132, 200, 23.8, 82, 6.0, 70}),
            Map.entry("watermelon", new double[]{99, 17, 50, 25.6, 85, 6.5, 51}),
            Map.entry("muskmelon", new double[]{100, 18, 50, 28.7, 92, 6.4, 25}),
            Map.entry("apple", new double[]{21, 134, 200, 22.6, 92, 5.9, 113}),
            Map.entry("orange", new double[]{20, 17, 10, 22.8, 92, 7.0, 110}),
            Map.entry("papaya", new double[]{50, 59, 50, 33.7, 92, 6.7, 143}),
            Map.entry("coconut", new double[]{22, 17, 31, 27.4, 95, 6.0, 176}),
            Map.entry("cotton", new double[]{118, 46, 20, 24.0, 80, 6.9, 80}),
            Map.entry("jute", new double[]{78, 47, 40, 25.0, 80, 6.7, 175}),
            Map.entry("coffee", new double[]{101, 29, 30, 25.5, 59, 6.8, 158}));
}
