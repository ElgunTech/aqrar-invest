package az.agro.portal.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ClimateRiskTest {

    /** Ten synthetic years: mild, but every April has a frosty night and one winter reaches -15 °C. */
    private static Object[] series(boolean lateFrost) {
        List<LocalDate> days = new ArrayList<>();
        for (LocalDate d = LocalDate.of(2015, 1, 1); !d.isAfter(LocalDate.of(2024, 12, 31)); d = d.plusDays(1)) days.add(d);
        double[] tmax = new double[days.size()], tmin = new double[days.size()], pr = new double[days.size()];
        for (int i = 0; i < days.size(); i++) {
            int m = days.get(i).getMonthValue();
            tmax[i] = m >= 6 && m <= 8 ? 33 : 15;
            tmin[i] = m == 1 ? -3 : 5;
            if (lateFrost && m == 4 && days.get(i).getDayOfMonth() == 10) tmin[i] = -2;
            pr[i] = 1;
        }
        tmin[10] = -15;
        return new Object[]{days, tmax, tmin, pr};
    }

    @SuppressWarnings("unchecked")
    @Test
    void pomegranateFlagsWinterAndLateFrost() {
        Object[] s = series(true);
        var days = (List<LocalDate>) s[0];
        var ind = ClimateService.indicators(days, (double[]) s[1], (double[]) s[2], (double[]) s[3]);
        assertThat(ind.yearsWithLateFrost()).isEqualTo(10);
        assertThat(ind.coldestNight()).isEqualTo(-15.0);
        var risk = ClimateService.cropRisk("pomegranate", days, (double[]) s[1], (double[]) s[2], (double[]) s[3], ind, true);
        assertThat(risk.overall()).isEqualTo("HIGH");
        assertThat(risk.risks().get(0).level()).isEqualTo("HIGH"); // -15 is below pomegranate's -12
    }

    @SuppressWarnings("unchecked")
    @Test
    void chickpeaIgnoresLateFrostAndHasNoWinterRisk() {
        Object[] s = series(false);
        var days = (List<LocalDate>) s[0];
        var ind = ClimateService.indicators(days, (double[]) s[1], (double[]) s[2], (double[]) s[3]);
        var risk = ClimateService.cropRisk("chickpea", days, (double[]) s[1], (double[]) s[2], (double[]) s[3], ind, true);
        assertThat(risk.risks()).noneMatch(r -> r.factor().contains("şaxta"));
        assertThat(risk.overall()).isNotEqualTo("HIGH");
    }

    @SuppressWarnings("unchecked")
    @Test
    void wheatSurvivesMinus15AndUsesWinterRain() {
        Object[] s = series(true);
        var days = (List<LocalDate>) s[0];
        var ind = ClimateService.indicators(days, (double[]) s[1], (double[]) s[2], (double[]) s[3]);
        var risk = ClimateService.cropRisk("wheat", days, (double[]) s[1], (double[]) s[2], (double[]) s[3], ind, false);
        assertThat(risk.name()).isEqualTo("Payızlıq buğda");
        assertThat(risk.risks().get(0).level()).isEqualTo("LOW"); // -15 is well above hardened wheat at -22
        assertThat(risk.risks()).noneMatch(r -> r.factor().equals("Gec yaz şaxtası"));
        assertThat(risk.risks()).anyMatch(r -> r.note().contains("oktyabr–iyun"));
    }
}
