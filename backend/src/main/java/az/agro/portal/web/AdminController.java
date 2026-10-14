package az.agro.portal.web;

import az.agro.portal.ai.CropRecommendationService;
import az.agro.portal.domain.ApplicationStatus;
import az.agro.portal.domain.AuditLog;
import az.agro.portal.domain.IntegrationEvent;
import az.agro.portal.dto.ApplicationDtos.*;
import az.agro.portal.dto.CompetitionDtos.*;
import az.agro.portal.dto.Labels;
import az.agro.portal.dto.PlotDtos.*;
import az.agro.portal.integration.mock.MockEktisController;
import az.agro.portal.repo.AuditLogRepository;
import az.agro.portal.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "İnzibati panel", description = "Qiymətləndirici və administrator əməliyyatları")
public class AdminController {

    private final ApplicationService applications;
    private final PlotService plots;
    private final CompetitionService competitions;
    private final StatsService stats;
    private final IntegrationService integration;
    private final MockEktisController mockEktis;
    private final AuditLogRepository auditRepo;
    private final AuditService audit;
    private final CropRecommendationService ai;

    public AdminController(ApplicationService applications, PlotService plots, CompetitionService competitions, StatsService stats,
                           IntegrationService integration, MockEktisController mockEktis, AuditLogRepository auditRepo,
                           AuditService audit, CropRecommendationService ai) {
        this.applications = applications;
        this.plots = plots;
        this.competitions = competitions;
        this.stats = stats;
        this.integration = integration;
        this.mockEktis = mockEktis;
        this.auditRepo = auditRepo;
        this.audit = audit;
        this.ai = ai;
    }

    // ---------------------------------------------------------------- dashboard & reports

    @Operation(summary = "İdarəetmə paneli statistikası")
    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        return stats.dashboard();
    }

    @Operation(summary = "Müraciətlər hesabatı (CSV, Excel-də açılır)")
    @GetMapping(value = "/reports/applications.csv")
    public ResponseEntity<byte[]> report() {
        StringBuilder csv = new StringBuilder("﻿"); // BOM so Excel reads UTF-8
        csv.append("Nömrə;Sahibkar;FİN/VÖEN;Müsabiqə;Sahə;Rayon;Fəaliyyət;İnvestisiya (AZN);Avto-bal;Status;EKTİS;Tarix\n");
        for (ApplicationListItem a : applications.adminList(null, null, null)) {
            csv.append(String.join(";", cell(a.applicationNumber()), cell(a.applicantName()), cell(a.taxIdMasked()),
                    cell(a.competitionTitle()), cell(a.plotCode()), cell(a.district()), cell(a.activityType().label()),
                    String.valueOf(a.plannedInvestment()), String.valueOf(a.autoScore()), cell(a.status().label()),
                    cell(a.ektisStatus().label()), a.createdAt().toString())).append('\n');
        }
        audit.log("REPORT_EXPORTED", "InvestmentApplication", null, "applications.csv");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=muracietler-" + LocalDate.now() + ".csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String cell(String s) {
        if (s == null) return "";
        String v = s.replace("\"", "\"\"");
        if (!v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0) v = "'" + v; // CSV formula-injection guard
        return "\"" + v + "\"";
    }

    // ---------------------------------------------------------------- applications

    @Operation(summary = "Daxil olan müraciətlər (şəxsi məlumatlar maskalanıb)")
    @GetMapping("/applications")
    public List<ApplicationListItem> applications(@RequestParam(required = false) ApplicationStatus status,
                                                  @RequestParam(required = false) Long competitionId,
                                                  @RequestParam(required = false) String q) {
        return applications.adminList(status, competitionId, q);
    }

    @Operation(summary = "Müraciətə baxış (baxış audit jurnalına yazılır)")
    @GetMapping("/applications/{id}")
    public ApplicationDto application(@PathVariable Long id) {
        return applications.adminGet(id);
    }

    @Operation(summary = "Müraciətin statusunu dəyiş")
    @PostMapping("/applications/{id}/status")
    public ApplicationDto changeStatus(@PathVariable Long id, @Valid @RequestBody StatusChangeRequest r) {
        return applications.changeStatus(id, r);
    }

    @Operation(summary = "Komissiya üzvünün müstəqil balı (maraqlar toqquşması bəyannaməsi ilə)")
    @PostMapping("/applications/{id}/score")
    public ApplicationDto score(@PathVariable Long id, @Valid @RequestBody ScoreRequest r) {
        return applications.score(id, r);
    }

    @Operation(summary = "Müraciət sənədini yüklə")
    @GetMapping("/applications/{id}/documents/{docId}")
    public ResponseEntity<Resource> document(@PathVariable Long id, @PathVariable Long docId) {
        return MeController.download(applications.document(id, docId));
    }

    // ---------------------------------------------------------------- plots

    @Operation(summary = "Bütün sahələr")
    @GetMapping("/plots")
    public List<PlotDto> plots() {
        return plots.search(new PlotFilter(null, null, null, null, null, null, null, null, null));
    }

    @Operation(summary = "Yeni sahə əlavə et")
    @PostMapping("/plots")
    public PlotDto createPlot(@Valid @RequestBody PlotRequest r) {
        return plots.create(r);
    }

    @Operation(summary = "Sahəni redaktə et")
    @PutMapping("/plots/{id}")
    public PlotDto updatePlot(@PathVariable Long id, @Valid @RequestBody PlotRequest r) {
        return plots.update(id, r);
    }

    @Operation(summary = "Sahəni sil (yalnız administrator)")
    @DeleteMapping("/plots/{id}")
    public Map<String, Object> deletePlot(@PathVariable Long id) {
        plots.delete(id);
        return Map.of("ok", true);
    }

    // ---------------------------------------------------------------- competitions

    @Operation(summary = "Bütün müsabiqələr")
    @GetMapping("/competitions")
    public List<CompetitionDto> competitions() {
        return competitions.listAll();
    }

    @Operation(summary = "Müsabiqə yarat (qaralama)")
    @PostMapping("/competitions")
    public CompetitionDto createCompetition(@Valid @RequestBody CompetitionRequest r) {
        return competitions.create(r);
    }

    @Operation(summary = "Qaralamanı redaktə et")
    @PutMapping("/competitions/{id}")
    public CompetitionDto updateCompetition(@PathVariable Long id, @Valid @RequestBody CompetitionRequest r) {
        return competitions.update(id, r);
    }

    @Operation(summary = "Təsdiqə göndər")
    @PostMapping("/competitions/{id}/submit")
    public CompetitionDto submit(@PathVariable Long id) {
        return competitions.submitForApproval(id);
    }

    @Operation(summary = "Təsdiq et və elan et (administrator, müəllifdən fərqli şəxs)")
    @PostMapping("/competitions/{id}/approve")
    public CompetitionDto approve(@PathVariable Long id, @RequestBody(required = false) ReviewRequest r) {
        return competitions.approve(id, r == null ? null : r.note());
    }

    @Operation(summary = "Düzəliş üçün geri qaytar")
    @PostMapping("/competitions/{id}/reject")
    public CompetitionDto reject(@PathVariable Long id, @RequestBody(required = false) ReviewRequest r) {
        return competitions.reject(id, r == null ? null : r.note());
    }

    @Operation(summary = "Müsabiqəni bağla")
    @PostMapping("/competitions/{id}/close")
    public CompetitionDto close(@PathVariable Long id) {
        return competitions.close(id);
    }

    // ---------------------------------------------------------------- integration

    @Operation(summary = "EKTİS inteqrasiya jurnalı (outbox / inbox)")
    @GetMapping("/integration/events")
    public List<Map<String, Object>> events() {
        return integration.latest().stream().map(AdminController::toMap).toList();
    }

    @Operation(summary = "Uğursuz hadisəni yenidən göndər")
    @PostMapping("/integration/events/{id}/retry")
    public Map<String, Object> retry(@PathVariable Long id) {
        integration.retry(id);
        return Map.of("ok", true);
    }

    @Operation(summary = "EKTİS simulyatorunun vəziyyəti və qəbul etdiyi mesajlar")
    @GetMapping("/integration/mock")
    public Map<String, Object> mockState() {
        return Map.of("outage", mockEktis.isOutage(), "inbox", mockEktis.inbox());
    }

    @Operation(summary = "Demo: EKTİS-in əlçatmazlığını simulyasiya et (outbox + retry nümayişi)")
    @PostMapping("/integration/mock/outage")
    public Map<String, Object> outage(@RequestParam boolean enabled) {
        mockEktis.setOutage(enabled);
        audit.log("EKTIS_OUTAGE_SIMULATION", "Integration", null, enabled ? "ON" : "OFF");
        return Map.of("outage", enabled);
    }

    private static Map<String, Object> toMap(IntegrationEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId());
        m.put("direction", e.getDirection());
        m.put("eventType", e.getEventType());
        m.put("aggregateId", e.getAggregateId());
        m.put("status", Labels.of(e.getStatus()));
        m.put("attempts", e.getAttempts());
        m.put("lastError", e.getLastError());
        m.put("externalReference", e.getExternalReference());
        m.put("payload", e.getPayload());
        m.put("createdAt", e.getCreatedAt());
        m.put("processedAt", e.getProcessedAt());
        return m;
    }

    // ---------------------------------------------------------------- audit & AI (ADMIN only)

    @Operation(summary = "Audit jurnalı (yalnız administrator)")
    @GetMapping("/audit")
    public List<AuditLog> auditLog() {
        return auditRepo.findTop200ByOrderByCreatedAtDesc();
    }

    @Operation(summary = "AI modelini diskdən yenidən yüklə (yeni öyrədilmiş model üçün)")
    @PostMapping("/ai/reload")
    public Map<String, Object> reloadModel() {
        boolean ok = ai.reload();
        audit.log("AI_MODEL_RELOADED", "AiModel", null, ok ? "loaded" : "not found");
        return ai.info();
    }
}
