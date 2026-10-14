package az.agro.portal.ai;

import az.agro.portal.domain.LandPlot;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

/** The AI model's input: soil nutrients and climate. Order matches the training features. */
public record SoilClimate(
        @DecimalMin("0") @DecimalMax("300") double nitrogen,
        @DecimalMin("0") @DecimalMax("300") double phosphorus,
        @DecimalMin("0") @DecimalMax("300") double potassium,
        @DecimalMin("-10") @DecimalMax("50") double temperature,
        @DecimalMin("0") @DecimalMax("100") double humidity,
        @DecimalMin("0") @DecimalMax("14") double ph,
        @DecimalMin("0") @DecimalMax("500") double rainfall) {

    public static final String[] FEATURES = {"N", "P", "K", "temperature", "humidity", "ph", "rainfall"};

    public static SoilClimate of(LandPlot p) {
        return new SoilClimate(p.getNitrogen(), p.getPhosphorus(), p.getPotassium(),
                p.getAvgTemperature(), p.getHumidity(), p.getPh(), p.getRainfall());
    }

    public float[] toVector() {
        return new float[]{(float) nitrogen, (float) phosphorus, (float) potassium,
                (float) temperature, (float) humidity, (float) ph, (float) rainfall};
    }
}
