package az.agro.portal.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class CompetitionDtos {

    private CompetitionDtos() {
    }

    public record PlotRef(Long id, String code, String title, String district, double areaHa, String activityLabel) {
    }

    public record CompetitionDto(
            Long id, String code, String title, String description, String requirements,
            LocalDate startDate, LocalDate deadline, long daysLeft, boolean open,
            PlotDtos.Label status,
            List<PlotRef> plots,
            String createdBy, String approvedBy, Instant approvedAt, String reviewNote,
            long applicationCount, Instant createdAt) {
    }

    public record CompetitionRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 4000) String description,
            @Size(max = 4000) String requirements,
            LocalDate startDate,
            @NotNull @Future(message = "Son müraciət tarixi gələcəkdə olmalıdır") LocalDate deadline,
            @NotEmpty(message = "Ən azı bir sahə seçilməlidir") List<Long> plotIds) {
    }

    public record ReviewRequest(@Size(max = 1000) String note) {
    }
}
