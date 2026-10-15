package az.agro.portal.web;

import az.agro.portal.domain.DocumentType;
import az.agro.portal.domain.Notification;
import az.agro.portal.dto.ApplicationDtos.*;
import az.agro.portal.security.CurrentUser;
import az.agro.portal.service.ApplicationService;
import az.agro.portal.service.AuditService;
import az.agro.portal.service.IntegrationService;
import az.agro.portal.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Şəxsi kabinet", description = "Sahibkarın müraciətləri və bildirişləri")
public class MeController {

    private final ApplicationService applications;
    private final NotificationService notifications;
    private final IntegrationService integration;
    private final CurrentUser currentUser;
    private final AuditService audit;

    public MeController(ApplicationService applications, NotificationService notifications, IntegrationService integration,
                        CurrentUser currentUser, AuditService audit) {
        this.applications = applications;
        this.notifications = notifications;
        this.integration = integration;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Operation(summary = "Elektron müraciət göndər (multipart: data=JSON, files[], types[])")
    @PostMapping(value = "/applications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SubmitResult submit(@Valid @RequestPart("data") ApplicationRequest data,
                               @RequestPart(name = "files", required = false) List<MultipartFile> files,
                               @RequestParam(name = "types", required = false) List<DocumentType> types) {
        return applications.submit(data, files, types);
    }

    @Operation(summary = "Mənim müraciətlərim")
    @GetMapping("/applications")
    public List<ApplicationListItem> list() {
        return applications.mine();
    }

    @Operation(summary = "Müraciətin detalları, tarixçəsi və sənədləri")
    @GetMapping("/applications/{id}")
    public ApplicationDto get(@PathVariable Long id) {
        return applications.mine(id);
    }

    @Operation(summary = "Əlavə məlumat sorğusuna cavab (multipart: comment, files[], types[])")
    @PostMapping(value = "/applications/{id}/reply", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApplicationDto reply(@PathVariable Long id,
                                @RequestParam String comment,
                                @RequestPart(name = "files", required = false) List<MultipartFile> files,
                                @RequestParam(name = "types", required = false) List<DocumentType> types) {
        if (comment.isBlank() || comment.length() > 2000) throw ApiException.badRequest("Cavab mətni 1–2000 simvol olmalıdır");
        return applications.reply(id, comment.trim(), files, types);
    }

    @Operation(summary = "Sənədi yüklə")
    @GetMapping("/applications/{id}/documents/{docId}")
    public ResponseEntity<Resource> document(@PathVariable Long id, @PathVariable Long docId) {
        return download(applications.document(id, docId));
    }

    @Operation(summary = "Bildirişlər")
    @GetMapping("/notifications")
    public List<Map<String, Object>> notifications() {
        return notifications.latest(currentUser.require().getId()).stream().map(MeController::toMap).toList();
    }

    @Operation(summary = "Bütün bildirişləri oxunmuş et")
    @PostMapping("/notifications/read-all")
    public Map<String, Object> readAll() {
        notifications.markAllRead(currentUser.require().getId());
        return Map.of("ok", true);
    }

    @Operation(summary = "EKTİS fermer reyestrindən məlumatların avtomatik doldurulması")
    @GetMapping("/registry/{taxId}")
    public Map<String, Object> registry(@PathVariable String taxId) {
        if (!taxId.matches("^([A-Za-z0-9]{7}|\\d{10})$")) throw ApiException.badRequest("FİN 7 simvol, VÖEN 10 rəqəm olmalıdır");
        // A FİN may only be looked up by its owner (verified via myGov); VÖEN data of companies is public.
        String own = currentUser.require().getTaxId();
        if (!taxId.matches("\\d{10}") && (own == null || !own.equalsIgnoreCase(taxId))) {
            throw ApiException.forbidden("Yalnız öz FİN-iniz (myGov ilə təsdiqlənmiş) və ya VÖEN üzrə sorğu mümkündür");
        }
        audit.log("REGISTRY_LOOKUP", "Farmer", null, "EKTİS reyestr sorğusu");
        try {
            return integration.findFarmer(taxId)
                    .<Map<String, Object>>map(f -> Map.of("found", true, "farmer", f))
                    .orElse(Map.of("found", false));
        } catch (Exception e) {
            return Map.of("found", false, "unavailable", true);
        }
    }

    private static Map<String, Object> toMap(Notification n) {
        return Map.of("id", n.getId(), "title", n.getTitle(), "message", n.getMessage() == null ? "" : n.getMessage(),
                "link", n.getLink() == null ? "" : n.getLink(), "read", n.isRead(), "createdAt", n.getCreatedAt().toString());
    }

    static ResponseEntity<Resource> download(ApplicationService.DocumentFile f) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(f.fileName(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(f.contentType() == null ? "application/octet-stream" : f.contentType()))
                .body(f.resource());
    }
}
