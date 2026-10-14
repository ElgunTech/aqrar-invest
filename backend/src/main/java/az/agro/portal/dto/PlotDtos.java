package az.agro.portal.dto;

import az.agro.portal.domain.ActivityType;
import az.agro.portal.domain.MineClearanceStatus;
import az.agro.portal.domain.PlotStatus;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

public final class PlotDtos {

    private PlotDtos() {
    }

    public record Label(String code, String label) {
    }

    public record CompetitionRef(Long id, String code, String title, LocalDate deadline, long daysLeft) {
    }

    public record CropRef(String code, String name, double probability) {
    }

    public record PlotDto(
            Long id, String code, String cadastreNumber, String title, String district, String village,
            double latitude, double longitude, double areaHa,
            Label activityType, String soilType,
            double nitrogen, double phosphorus, double potassium, double ph,
            double avgTemperature, double humidity, double rainfall,
            double waterSourceKm, double roadKm, boolean irrigationAvailable, boolean electricityAvailable,
            Label mineClearance, LocalDate mineClearanceDate,
            int leaseYears, long minInvestment, String usageTerms, String description,
            Label status,
            CompetitionRef openCompetition,
            long applicationCount,
            CropRef aiTopCrop,
            String boundaryGeoJson, String anamaRef, LocalDate clearanceStartDate, String dataSource) {
    }

    /** Filter for the catalogue and the map. All fields optional. */
    public record PlotFilter(
            ActivityType activity, String district, Double minArea, Double maxArea,
            MineClearanceStatus mineClearance, String q, Boolean onlyOpen, String crop, String sort) {
    }

    public record PlotRequest(
            @NotBlank @Size(max = 30) String code,
            @Size(max = 40) String cadastreNumber,
            @NotBlank @Size(max = 150) String title,
            @NotBlank @Size(max = 60) String district,
            @Size(max = 80) String village,
            @DecimalMin("38.5") @DecimalMax("41.0") double latitude,
            @DecimalMin("45.0") @DecimalMax("48.5") double longitude,
            @Positive double areaHa,
            @NotNull ActivityType activityType,
            @Size(max = 80) String soilType,
            @PositiveOrZero double nitrogen,
            @PositiveOrZero double phosphorus,
            @PositiveOrZero double potassium,
            @DecimalMin("0") @DecimalMax("14") double ph,
            @DecimalMin("-10") @DecimalMax("50") double avgTemperature,
            @DecimalMin("0") @DecimalMax("100") double humidity,
            @PositiveOrZero double rainfall,
            @PositiveOrZero double waterSourceKm,
            @PositiveOrZero double roadKm,
            boolean irrigationAvailable,
            boolean electricityAvailable,
            @NotNull MineClearanceStatus mineClearance,
            LocalDate mineClearanceDate,
            @Min(1) @Max(99) int leaseYears,
            @PositiveOrZero long minInvestment,
            @Size(max = 2000) String usageTerms,
            @Size(max = 2000) String description,
            PlotStatus status) {
    }

    /** "Which plot suits me?" wizard input. */
    public record MatchRequest(
            ActivityType activity,
            @PositiveOrZero Long budget,
            Double minArea,
            Double maxArea,
            List<String> districts,
            String desiredCrop,
            boolean needIrrigation,
            Integer experienceYears) {
    }

    public record MatchReason(String text, boolean positive) {
    }

    public record MatchResult(PlotDto plot, int score, List<MatchReason> reasons) {
    }
}
