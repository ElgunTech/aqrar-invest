package az.agro.portal.dto;

import az.agro.portal.domain.ActivityType;
import az.agro.portal.domain.ApplicantType;
import az.agro.portal.domain.ApplicationStatus;
import az.agro.portal.service.IntegrityService;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

public final class ApplicationDtos {

    private ApplicationDtos() {
    }

    public record ApplicationRequest(
            @NotNull Long competitionId,
            @NotNull Long plotId,
            @NotNull ApplicantType applicantType,
            @NotBlank @Size(max = 200) String applicantName,
            @NotBlank @Pattern(regexp = "^([A-Za-z0-9]{7}|\\d{10})$", message = "FİN 7 simvol, VÖEN 10 rəqəm olmalıdır") String taxId,
            @NotBlank @Pattern(regexp = "^[+0-9 ()-]{9,20}$", message = "Telefon nömrəsi yanlışdır") String phone,
            @NotBlank @Email @Size(max = 120) String email,
            @Size(max = 300) String address,
            @NotNull ActivityType activityType,
            @Size(max = 60) String plannedCrop,
            @Positive(message = "İnvestisiya məbləği müsbət olmalıdır") long plannedInvestment,
            @Min(0) @Max(100) int ownFundsPercent,
            @Min(0) @Max(10000) int jobsCreated,
            @Min(0) @Max(10000) int returneeJobs,
            @Min(1) @Max(240) int projectMonths,
            @Min(0) @Max(80) int experienceYears,
            @NotBlank @Size(min = 100, max = 6000, message = "Biznes plan ən azı 100 simvol olmalıdır") String businessPlan) {
    }

    public record DocumentDto(Long id, PlotDtos.Label type, String originalName, String contentType, long sizeBytes, Instant uploadedAt) {
    }

    public record HistoryDto(PlotDtos.Label fromStatus, PlotDtos.Label toStatus, String comment, String changedBy, Instant changedAt) {
    }

    public record ScoreItem(String criterion, int points, int max, String note) {
    }

    public record ScoreBreakdown(int total, List<ScoreItem> items) {
    }

    public record CommissionScore(String evaluator, int feasibility, int financing, int socialImpact, int technology,
                                  int total, String comment, Instant updatedAt, boolean mine) {
    }

    public record Commission(List<CommissionScore> scores, Integer average, int required) {
    }

    public record ScoreRequest(
            @Min(0) @Max(10) int feasibility,
            @Min(0) @Max(10) int financing,
            @Min(0) @Max(10) int socialImpact,
            @Min(0) @Max(10) int technology,
            @Size(max = 1000) String comment,
            @AssertTrue(message = "Maraqlar toqquşmasının olmadığını təsdiq edin") boolean noConflict) {
    }

    public record ApplicationDto(
            Long id, String applicationNumber, PlotDtos.Label status,
            Long competitionId, String competitionCode, String competitionTitle,
            Long plotId, String plotCode, String plotTitle, String district,
            boolean blind, PlotDtos.Label applicantType, String applicantName, String taxId, String phone, String email, String address,
            PlotDtos.Label activityType, String plannedCrop, String plannedCropName,
            long plannedInvestment, int ownFundsPercent, int jobsCreated, int returneeJobs, int projectMonths, int experienceYears,
            String businessPlan,
            ScoreBreakdown score,
            Commission commission,
            List<IntegrityService.Signal> integrity,
            String decisionNote,
            PlotDtos.Label ektisStatus, String ektisReference,
            Instant createdAt, Instant updatedAt,
            List<DocumentDto> documents,
            List<HistoryDto> history,
            List<PlotDtos.Label> allowedNext) {
    }

    public record ApplicationListItem(
            Long id, String applicationNumber, boolean blind, String applicantName, String taxIdMasked,
            String competitionTitle, String plotCode, String plotTitle, String district,
            PlotDtos.Label activityType, long plannedInvestment, int autoScore, int signalCount,
            PlotDtos.Label status, PlotDtos.Label ektisStatus, Instant createdAt, Instant updatedAt) {
    }

    public record SubmitResult(Long id, String applicationNumber, PlotDtos.Label status, int autoScore) {
    }

    public record StatusChangeRequest(@NotNull ApplicationStatus status, @Size(max = 2000) String comment) {
    }

    public record ReplyRequest(@NotBlank @Size(max = 2000) String comment) {
    }
}
