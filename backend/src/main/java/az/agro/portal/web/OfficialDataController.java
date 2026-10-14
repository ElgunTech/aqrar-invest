package az.agro.portal.web;

import az.agro.portal.service.AuditService;
import az.agro.portal.service.OfficialDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@Tag(name = "Rəsmi açıq məlumatlar", description = "Dövlət Statistika Komitəsi və ANAMA (opendata.az)")
public class OfficialDataController {

    private final OfficialDataService official;
    private final AuditService audit;

    public OfficialDataController(OfficialDataService official, AuditService audit) {
        this.official = official;
        this.audit = audit;
    }

    @Operation(summary = "Rayon üzrə rəsmi statistika (son il, 10 illik sıra, ölkə və iqtisadi rayon müqayisəsi)")
    @GetMapping("/api/v1/public/official/district/{district}")
    public List<OfficialDataService.IndicatorSummary> district(@PathVariable String district) {
        return official.district(district);
    }

    @Operation(summary = "Bitkinin rəsmi məhsuldarlığı (ton/ha), rayon, yoxdursa ölkə üzrə")
    @GetMapping("/api/v1/public/official/yield")
    public Map<String, Object> yield(@RequestParam String crop, @RequestParam String district) {
        return official.cropYield(crop, district).orElse(Map.of());
    }

    @Operation(summary = "Mənbələr: dərc edən qurum, keçid, lisenziya, yüklənmə tarixi")
    @GetMapping("/api/v1/public/official/sources")
    public Map<String, Object> sources() {
        return official.sources();
    }

    @Operation(summary = "ANAMA: Kənd Təsərrüfatı Nazirliyinin sifarişi ilə təmizlənmiş sahələr (GeoJSON)")
    @GetMapping(value = "/api/v1/public/official/anama", produces = "application/geo+json")
    public ResponseEntity<byte[]> anama() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)))
                .contentType(MediaType.parseMediaType("application/geo+json")).body(official.anamaLayer());
    }

    @Operation(summary = "Statistikanı rəsmi azstat API-dən canlı yenilə (administrator)")
    @PostMapping("/api/v1/admin/ai/official-refresh")
    public Map<String, Object> refresh() {
        Map<String, Object> r = official.refresh();
        audit.log("OFFICIAL_DATA_REFRESHED", "OpenData", null, String.valueOf(r.get("updated")) + " cədvəl yeniləndi");
        return r;
    }
}
