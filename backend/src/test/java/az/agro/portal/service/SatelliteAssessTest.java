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
    void bareSixMonthsAfterAwardRaisesAlert() {
        var series = List.of(o("2025-11-10", 0.15), o("2026-03-10", 0.18), o("2026-06-10", 0.17), o("2026-09-10", 0.16));
        String[] v = SatelliteService.assess(series, LocalDate.parse("2026-02-01"), LocalDate.parse("2026-10-01"));
        assertEquals("ALERT", v[0]);
    }

    @Test
    void greeningAfterAwardIsActive() {
        var series = List.of(o("2025-11-10", 0.15), o("2026-05-10", 0.42));
        assertEquals("ACTIVE", SatelliteService.assess(series, LocalDate.parse("2026-02-01"), LocalDate.parse("2026-10-01"))[0]);
    }

    @Test
    void notAwardedIsBaseline() {
        assertEquals("BASELINE", SatelliteService.assess(List.of(o("2026-09-10", 0.2)), null, LocalDate.parse("2026-10-01"))[0]);
    }
}
