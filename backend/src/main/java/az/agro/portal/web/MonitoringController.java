package az.agro.portal.web;

import az.agro.portal.service.MonitoringService;
import az.agro.portal.service.MonitoringService.ProjectDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@Tag(name = "Öhdəliklərin monitorinqi", description = "Qalib investorun öhdəlikləri, hesabatları və nazirliyin yoxlaması")
public class MonitoringController {

    private final MonitoringService monitoring;

    public MonitoringController(MonitoringService monitoring) {
        this.monitoring = monitoring;
    }

    @Operation(summary = "Mənim layihəmin öhdəlik planı")
    @GetMapping("/api/v1/me/applications/{id}/monitoring")
    public ProjectDto mine(@PathVariable Long id) {
        return monitoring.mine(id);
    }

    @Operation(summary = "Mərhələ üzrə hesabat (foto + GPS koordinatları)")
    @PostMapping(value = "/api/v1/me/applications/{id}/milestones/{mid}/report", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProjectDto report(@PathVariable Long id, @PathVariable Long mid, @RequestParam String text, @RequestParam long investment,
                             @RequestPart("photo") MultipartFile photo,
                             @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng) {
        return monitoring.report(id, mid, text, investment, photo, lat, lng);
    }

    @Operation(summary = "Hesabat fotosu")
    @GetMapping({"/api/v1/me/milestones/{mid}/photo", "/api/v1/admin/milestones/{mid}/photo"})
    public ResponseEntity<Resource> photo(@PathVariable Long mid) {
        return MeController.download(monitoring.photo(mid));
    }

    @Operation(summary = "Bütün qalib layihələrin monitorinq portfeli (svetofor)")
    @GetMapping("/api/v1/admin/monitoring")
    public List<ProjectDto> portfolio() {
        return monitoring.portfolio();
    }

    @Operation(summary = "Hesabatı qəbul et və ya geri qaytar")
    @PostMapping("/api/v1/admin/milestones/{mid}/review")
    public ProjectDto review(@PathVariable Long mid, @RequestBody Map<String, Object> body) {
        return monitoring.review(mid, Boolean.TRUE.equals(body.get("accepted")), (String) body.get("note"));
    }
}
