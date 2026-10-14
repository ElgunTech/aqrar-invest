package az.agro.portal.web;

import az.agro.portal.ai.CropCatalog;
import az.agro.portal.ai.CropRecommendation;
import az.agro.portal.ai.CropRecommendationService;
import az.agro.portal.ai.SoilClimate;
import az.agro.portal.domain.*;
import az.agro.portal.dto.CompetitionDtos.CompetitionDto;
import az.agro.portal.dto.Labels;
import az.agro.portal.dto.PlotDtos.*;
import az.agro.portal.service.ApplicationService;
import az.agro.portal.service.CompetitionService;
import az.agro.portal.service.PlotService;
import az.agro.portal.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/public")
@Tag(name = "İctimai API", description = "Giriş tələb etməyən: sahələr, müsabiqələr, AI tövsiyəsi, statistika")
public class PublicController {

    private final PlotService plots;
    private final CompetitionService competitions;
    private final StatsService stats;
    private final CropRecommendationService ai;
    private final ApplicationService applications;
    private final az.agro.portal.service.SatelliteService satellite;
    private final az.agro.portal.service.SolarService solar;

    public PublicController(PlotService plots, CompetitionService competitions, StatsService stats, CropRecommendationService ai,
                            ApplicationService applications, az.agro.portal.service.SatelliteService satellite,
                            az.agro.portal.service.SolarService solar) {
        this.satellite = satellite;
        this.solar = solar;
        this.applications = applications;
        this.plots = plots;
        this.competitions = competitions;
        this.stats = stats;
        this.ai = ai;
    }

    @Operation(summary = "Sahələrin siyahısı və filtrlənməsi (xəritə və kataloq)")
    @GetMapping("/plots")
    public List<PlotDto> plots(@RequestParam(required = false) ActivityType activity,
                               @RequestParam(required = false) String district,
                               @RequestParam(required = false) Double minArea,
                               @RequestParam(required = false) Double maxArea,
                               @RequestParam(required = false) MineClearanceStatus mineClearance,
                               @RequestParam(required = false) String q,
                               @RequestParam(required = false) Boolean onlyOpen,
                               @RequestParam(required = false) String crop,
                               @RequestParam(required = false) String sort) {
        return plots.search(new PlotFilter(activity, district, minArea, maxArea, mineClearance, q, onlyOpen, crop, sort));
    }

    @Operation(summary = "Sahə haqqında ətraflı məlumat")
    @GetMapping("/plots/{id}")
    public PlotDto plot(@PathVariable Long id) {
        return plots.get(id);
    }

    @Operation(summary = "Sahələrin müqayisəsi (2–4 sahə)")
    @GetMapping("/plots/compare")
    public List<PlotDto> compare(@RequestParam List<Long> ids) {
        return plots.compare(ids);
    }

    @Operation(summary = "Peyk monitorinqi: Sentinel-2 NDVI sahənin sərhədi üzrə, aylıq")
    @GetMapping("/plots/{id}/satellite")
    public az.agro.portal.service.SatelliteService.Report satellite(@PathVariable Long id) {
        return satellite.report(id);
    }

    @Operation(summary = "Günəş enerjisi: sahənin uyğunluğu, PVGIS istehsal potensialı və tariflər")
    @GetMapping("/plots/{id}/solar")
    public az.agro.portal.service.SolarService.Report solar(@PathVariable Long id) {
        return solar.report(id);
    }

    @Operation(summary = "AI: sahə üçün bitki tövsiyəsi")
    @GetMapping("/plots/{id}/recommendation")
    public CropRecommendation recommendation(@PathVariable Long id) {
        return plots.recommendation(id);
    }

    @Operation(summary = "AI: istənilən torpaq/iqlim göstəriciləri üçün tövsiyə")
    @PostMapping("/ai/recommend")
    public CropRecommendation recommend(@Valid @RequestBody SoilClimate input) {
        return ai.recommend(input);
    }

    @Operation(summary = "AI: bir sorğuda bir neçə profil üçün tövsiyə (maksimum 60)")
    @PostMapping("/ai/recommend/batch")
    public List<CropRecommendation> recommendBatch(@RequestBody List<@Valid SoilClimate> inputs) {
        if (inputs == null || inputs.isEmpty() || inputs.size() > 60) throw ApiException.badRequest("1–60 profil göndərin");
        return inputs.stream().map(ai::recommend).toList();
    }

    @Operation(summary = "AI modelinin kartı (versiya, dəqiqlik, göstəricilərin əhəmiyyəti)")
    @GetMapping("/ai/model")
    public Map<String, Object> model() {
        return ai.info();
    }

    @Operation(summary = "\"Mənə hansı sahə uyğundur?\" — uyğunluq reytinqi")
    @PostMapping("/match")
    public List<MatchResult> match(@Valid @RequestBody MatchRequest r) {
        return plots.match(r);
    }

    @Operation(summary = "Elan edilmiş müsabiqələr")
    @GetMapping("/competitions")
    public List<CompetitionDto> competitions() {
        return competitions.listPublic();
    }

    @Operation(summary = "Müsabiqə haqqında məlumat")
    @GetMapping("/competitions/{id}")
    public CompetitionDto competition(@PathVariable Long id) {
        return competitions.getPublic(id);
    }

    @Operation(summary = "Qəbzin həqiqiliyinin yoxlanması (QR kod)")
    @GetMapping("/verify/{number}")
    public Map<String, Object> verify(@PathVariable String number) {
        return applications.verify(number);
    }

    @Operation(summary = "Şəffaflıq statistikası (anonim)")
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return stats.publicStats();
    }

    @Operation(summary = "Soraqçalar: fəaliyyət növləri, statuslar, rayonlar, bitkilər")
    @GetMapping("/meta")
    public Map<String, Object> meta() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("activityTypes", labels(ActivityType.values()));
        m.put("mineClearance", labels(MineClearanceStatus.values()));
        m.put("plotStatuses", labels(PlotStatus.values()));
        m.put("applicationStatuses", labels(ApplicationStatus.values()));
        m.put("applicantTypes", labels(ApplicantType.values()));
        m.put("documentTypes", labels(DocumentType.values()));
        m.put("districts", plots.districts());
        m.put("crops", CropCatalog.all().entrySet().stream().map(e -> new Label(e.getKey(), e.getValue())).toList());
        return m;
    }

    private static List<Label> labels(Enum<?>[] values) {
        return Arrays.stream(values).map(Labels::of).toList();
    }
}
