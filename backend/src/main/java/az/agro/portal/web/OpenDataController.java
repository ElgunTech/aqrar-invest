package az.agro.portal.web;

import az.agro.portal.service.OcdsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@Tag(name = "Açıq məlumat (OCDS)", description = "Müsabiqələr və nəticələr Open Contracting Data Standard 1.1 formatında")
public class OpenDataController {

    private final OcdsService ocds;

    public OpenDataController(OcdsService ocds) {
        this.ocds = ocds;
    }

    @Operation(summary = "OCDS 1.1 release package: bütün elan edilmiş müsabiqələr, iştirakçılar və qaliblər")
    @GetMapping("/api/v1/public/open-data/ocds")
    public ResponseEntity<Map<String, Object>> ocds(@RequestParam(defaultValue = "false") boolean download, HttpServletRequest req) {
        String forwardedHost = req.getHeader("X-Forwarded-Host");
        String base = forwardedHost != null ? "https://" + forwardedHost
                : req.getScheme() + "://" + req.getServerName() + (req.getServerPort() == 80 || req.getServerPort() == 443 ? "" : ":" + req.getServerPort());
        var res = ResponseEntity.ok();
        if (download) res.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"aqrar-invest-ocds.json\"");
        return res.body(ocds.releasePackage(base));
    }
}
