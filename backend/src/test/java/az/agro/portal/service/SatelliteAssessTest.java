package az.agro.portal.service;

import az.agro.portal.service.SatelliteService.Observation;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SatelliteAssessTest {

    private static Observation o(String date, double ndvi) {
        return new Observation(date, "x", 1, ndvi, 0);
    }

    @Test
    void springGrassOnlyIsAlertAfterSixMonths() {
        // real pattern of a fallow plot: green in April from rain, dry from July
        var series = List.of(o("2025-09-04", 0.07), o("2026-04-02", 0.41), o("2026-06-01", 0.22), o("2026-08-05", 0.02), o("2026-09-04", 0.17));
        assertEquals("ALERT", SatelliteService.assess(series, LocalDate.parse("2025-08-15"), LocalDate.parse("2026-10-14"))[0]);
    }

    @Test
    void greenSummerIsActive() {
        var series = List.of(o("2025-09-10", 0.12), o("2026-04-10", 0.40), o("2026-07-10", 0.55));
        assertEquals("ACTIVE", SatelliteService.assess(series, LocalDate.parse("2026-02-01"), LocalDate.parse("2026-10-01"))[0]);
    }

    @Test
    void gainOverLastYearIsActive() {
        var series = List.of(o("2025-09-10", 0.10), o("2026-09-10", 0.28));
        assertEquals("ACTIVE", SatelliteService.assess(series, LocalDate.parse("2026-02-01"), LocalDate.parse("2026-10-01"))[0]);
    }

    @Test
    void beforeFirstSummerIsWatch() {
        var series = List.of(o("2025-11-10", 0.15), o("2026-04-10", 0.42));
        assertEquals("WATCH", SatelliteService.assess(series, LocalDate.parse("2026-01-10"), LocalDate.parse("2026-05-01"))[0]);
    }

    @Test
    void notAwardedIsBaseline() {
        assertEquals("BASELINE", SatelliteService.assess(List.of(o("2026-09-10", 0.2)), null, LocalDate.parse("2026-10-01"))[0]);
    }
}
