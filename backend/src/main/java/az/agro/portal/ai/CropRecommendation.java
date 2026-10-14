package az.agro.portal.ai;

import java.util.List;

/** AI output for one set of soil/climate values. */
public record CropRecommendation(
        boolean modelLoaded,
        String engine,
        String modelName,
        String modelVersion,
        Double testAccuracy,
        /** Top crops after the regional climate filter, probabilities re-normalised. */
        List<CropScore> recommendations,
        /** Raw model output (top 5), before the regional filter — shown for transparency. */
        List<CropScore> rawTop,
        /** Input features outside the range the model was trained on. */
        List<String> outOfRange,
        String explanation) {

    public record CropScore(String code, String name, double probability, boolean regionSuitable) {
    }

    public CropScore best() {
        return recommendations.isEmpty() ? null : recommendations.get(0);
    }
}
