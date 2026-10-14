package az.agro.portal.service;

import az.agro.portal.ai.CropRecommendation;
import az.agro.portal.ai.CropRecommendationService;
import az.agro.portal.ai.SoilClimate;
import az.agro.portal.domain.*;
import az.agro.portal.dto.Labels;
import az.agro.portal.dto.PlotDtos.*;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.web.ApiException;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PlotService {

    private final LandPlotRepository plots;
    private final CompetitionRepository competitions;
    private final ApplicationRepository applications;
    private final CropRecommendationService ai;
    private final AuditService audit;

    public PlotService(LandPlotRepository plots, CompetitionRepository competitions, ApplicationRepository applications,
                       CropRecommendationService ai, AuditService audit) {
        this.plots = plots;
        this.competitions = competitions;
        this.applications = applications;
        this.ai = ai;
        this.audit = audit;
    }

    /** Request-scoped lookup data so mapping N plots costs a constant number of queries. */
    private record Context(Map<Long, Competition> openByPlot, Map<Long, Long> appCounts) {
    }

    private Context context() {
        Map<Long, Competition> open = new HashMap<>();
        for (Competition c : competitions.findByStatusOrderByDeadlineAsc(CompetitionStatus.PUBLISHED)) {
            if (!c.isOpen()) continue;
            for (LandPlot p : c.getPlots()) open.putIfAbsent(p.getId(), c);
        }
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : applications.countPerPlot()) counts.put((Long) row[0], (Long) row[1]);
        return new Context(open, counts);
    }

    @Transactional(readOnly = true)
    public List<PlotDto> search(PlotFilter f) {
        Context ctx = context();
        List<PlotDto> result = plots.findAll(spec(f)).stream()
                .map(p -> toDto(p, ctx))
                .filter(d -> f.onlyOpen() == null || !f.onlyOpen() || d.openCompetition() != null)
                .filter(d -> f.crop() == null || f.crop().isBlank()
                        || (d.aiTopCrop() != null && d.aiTopCrop().code().equalsIgnoreCase(f.crop())))
                .collect(Collectors.toCollection(ArrayList::new));
        Comparator<PlotDto> order = switch (f.sort() == null ? "" : f.sort()) {
            case "area_desc" -> Comparator.comparingDouble(PlotDto::areaHa).reversed();
            case "area_asc" -> Comparator.comparingDouble(PlotDto::areaHa);
            case "investment_asc" -> Comparator.comparingLong(PlotDto::minInvestment);
            case "deadline" -> Comparator.comparing(d -> d.openCompetition() == null ? LocalDate.MAX : d.openCompetition().deadline());
            default -> Comparator.comparing(PlotDto::code);
        };
        result.sort(order);
        return result;
    }

    private static Specification<LandPlot> spec(PlotFilter f) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (f.activity() != null) ps.add(cb.equal(root.get("activityType"), f.activity()));
            if (f.district() != null && !f.district().isBlank()) ps.add(cb.equal(root.get("district"), f.district()));
            if (f.minArea() != null) ps.add(cb.greaterThanOrEqualTo(root.get("areaHa"), f.minArea()));
            if (f.maxArea() != null) ps.add(cb.lessThanOrEqualTo(root.get("areaHa"), f.maxArea()));
            if (f.mineClearance() != null) ps.add(cb.equal(root.get("mineClearance"), f.mineClearance()));
            if (f.q() != null && !f.q().isBlank()) {
                String like = "%" + f.q().trim().toLowerCase(Locale.ROOT) + "%";
                ps.add(cb.or(cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("code")), like),
                        cb.like(cb.lower(root.get("village")), like),
                        cb.like(cb.lower(root.get("district")), like)));
            }
            return cb.and(ps.toArray(Predicate[]::new));
        };
    }

    @Transactional(readOnly = true)
    public PlotDto get(Long id) {
        return toDto(find(id), context());
    }

    @Transactional(readOnly = true)
    public List<PlotDto> compare(List<Long> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > 4) throw ApiException.badRequest("Müqayisə üçün 2–4 sahə seçin");
        Context ctx = context();
        return ids.stream().map(this::find).map(p -> toDto(p, ctx)).toList();
    }

    @Transactional(readOnly = true)
    public CropRecommendation recommendation(Long plotId) {
        return ai.recommend(SoilClimate.of(find(plotId)));
    }

    public List<String> districts() {
        return plots.findDistricts();
    }

    LandPlot find(Long id) {
        return plots.findById(id).orElseThrow(() -> ApiException.notFound("Sahə"));
    }

    private PlotDto toDto(LandPlot p, Context ctx) {
        Competition c = ctx.openByPlot().get(p.getId());
        CompetitionRef ref = c == null ? null : new CompetitionRef(c.getId(), c.getCode(), c.getTitle(), c.getDeadline(),
                ChronoUnit.DAYS.between(LocalDate.now(), c.getDeadline()));
        CropRecommendation.CropScore best = ai.recommend(SoilClimate.of(p)).best();
        CropRef crop = best == null ? null : new CropRef(best.code(), best.name(), best.probability());
        return new PlotDto(p.getId(), p.getCode(), p.getCadastreNumber(), p.getTitle(), p.getDistrict(), p.getVillage(),
                p.getLatitude(), p.getLongitude(), p.getAreaHa(),
                Labels.of(p.getActivityType()), p.getSoilType(),
                p.getNitrogen(), p.getPhosphorus(), p.getPotassium(), p.getPh(),
                p.getAvgTemperature(), p.getHumidity(), p.getRainfall(),
                p.getWaterSourceKm(), p.getRoadKm(), p.isIrrigationAvailable(), p.isElectricityAvailable(),
                Labels.of(p.getMineClearance()), p.getMineClearanceDate(),
                p.getLeaseYears(), p.getMinInvestment(), p.getUsageTerms(), p.getDescription(),
                Labels.of(p.getStatus()), ref, ctx.appCounts().getOrDefault(p.getId(), 0L), crop,
                p.getBoundaryGeoJson(), p.getAnamaRef(), p.getClearanceStartDate(), p.getDataSource());
    }

    // ---------------------------------------------------------------- "Which plot suits me?"

    @Transactional(readOnly = true)
    public List<MatchResult> match(MatchRequest r) {
        Context ctx = context();
        List<MatchResult> results = new ArrayList<>();
        for (LandPlot p : plots.findAll()) {
            if (p.getStatus() == PlotStatus.ASSIGNED) continue;
            List<MatchReason> reasons = new ArrayList<>();
            double score = 0;

            // Activity (25)
            if (r.activity() == null) {
                score += 15;
            } else if (r.activity() == p.getActivityType()) {
                score += 25;
                reasons.add(new MatchReason("Təyinatı istədiyiniz fəaliyyətə uyğundur: " + p.getActivityType().getLabel(), true));
            } else {
                reasons.add(new MatchReason("Təyinatı fərqlidir: " + p.getActivityType().getLabel(), false));
            }

            // Budget (20)
            if (r.budget() != null && r.budget() > 0) {
                if (r.budget() >= p.getMinInvestment()) {
                    score += 20;
                    reasons.add(new MatchReason("Büdcəniz minimum investisiyanı ödəyir (" + fmt(p.getMinInvestment()) + " AZN)", true));
                } else if (r.budget() >= p.getMinInvestment() * 0.75) {
                    score += 10;
                    reasons.add(new MatchReason("Büdcə minimuma yaxındır (" + fmt(p.getMinInvestment()) + " AZN tələb olunur)", false));
                } else {
                    reasons.add(new MatchReason("Büdcə kifayət etmir: minimum " + fmt(p.getMinInvestment()) + " AZN", false));
                }
            } else {
                score += 10;
            }

            // Area (10)
            boolean areaOk = (r.minArea() == null || p.getAreaHa() >= r.minArea()) && (r.maxArea() == null || p.getAreaHa() <= r.maxArea());
            if (areaOk) {
                score += 10;
            } else {
                reasons.add(new MatchReason("Sahənin ölçüsü (" + p.getAreaHa() + " ha) istədiyiniz aralıqda deyil", false));
            }

            // Mine clearance (15)
            switch (p.getMineClearance()) {
                case CLEARED -> {
                    score += 15;
                    reasons.add(new MatchReason("Minadan tam təmizlənib", true));
                }
                case IN_PROGRESS -> {
                    score += 6;
                    reasons.add(new MatchReason("Minadan təmizlənmə davam edir", false));
                }
                case PLANNED -> reasons.add(new MatchReason("Minadan təmizlənmə hələ başlamayıb", false));
            }

            // Water & irrigation (15)
            double water = p.getWaterSourceKm() <= 1 ? 15 : p.getWaterSourceKm() <= 3 ? 10 : p.getWaterSourceKm() <= 6 ? 5 : 0;
            if (r.needIrrigation() && !p.isIrrigationAvailable()) water = Math.min(water, 3);
            score += water;
            if (water >= 10) reasons.add(new MatchReason("Su mənbəyinə yaxındır (" + p.getWaterSourceKm() + " km)", true));
            else if (r.needIrrigation()) reasons.add(new MatchReason("Suvarma infrastrukturu zəifdir", false));

            // Road (5)
            if (p.getRoadKm() <= 2) {
                score += 5;
                reasons.add(new MatchReason("Asfalt yola yaxındır (" + p.getRoadKm() + " km)", true));
            } else if (p.getRoadKm() <= 5) {
                score += 3;
            }

            // AI crop fit (10)
            if (r.desiredCrop() != null && !r.desiredCrop().isBlank()) {
                CropRecommendation rec = ai.recommend(SoilClimate.of(p));
                int rank = -1;
                for (int i = 0; i < rec.recommendations().size(); i++) {
                    if (rec.recommendations().get(i).code().equalsIgnoreCase(r.desiredCrop())) rank = i;
                }
                if (rank == 0) {
                    score += 10;
                    reasons.add(new MatchReason("AI: torpaq və iqlim " + rec.recommendations().get(0).name() + " üçün ən uyğundur", true));
                } else if (rank > 0) {
                    score += 6;
                    reasons.add(new MatchReason("AI: istədiyiniz bitki ilk 3 tövsiyə arasındadır", true));
                } else {
                    reasons.add(new MatchReason("AI: torpaq bu bitki üçün optimal deyil", false));
                }
            } else {
                score += 5;
            }

            // District preference (bonus, max total 100)
            if (r.districts() != null && !r.districts().isEmpty()) {
                if (r.districts().contains(p.getDistrict())) {
                    reasons.add(new MatchReason("Seçdiyiniz rayondadır: " + p.getDistrict(), true));
                } else {
                    score -= 10;
                }
            }

            if (ctx.openByPlot().containsKey(p.getId())) {
                reasons.add(new MatchReason("Hazırda açıq müsabiqədədir — müraciət edə bilərsiniz", true));
            }
            int finalScore = (int) Math.max(0, Math.min(100, Math.round(score)));
            results.add(new MatchResult(toDto(p, ctx), finalScore, reasons));
        }
        results.sort(Comparator.comparingInt(MatchResult::score).reversed());
        return results.stream().limit(10).toList();
    }

    private static String fmt(long n) {
        return String.format(Locale.ROOT, "%,d", n).replace(',', ' ');
    }

    // ---------------------------------------------------------------- Admin CRUD

    @Transactional
    public PlotDto create(PlotRequest r) {
        if (plots.existsByCode(r.code())) throw ApiException.conflict("Bu kodla sahə artıq mövcuddur");
        LandPlot p = new LandPlot();
        apply(p, r);
        plots.save(p);
        audit.log("PLOT_CREATED", "LandPlot", p.getId(), p.getCode() + " — " + p.getTitle());
        return toDto(p, context());
    }

    @Transactional
    public PlotDto update(Long id, PlotRequest r) {
        LandPlot p = find(id);
        if (!p.getCode().equals(r.code()) && plots.existsByCode(r.code())) throw ApiException.conflict("Bu kodla sahə artıq mövcuddur");
        apply(p, r);
        audit.log("PLOT_UPDATED", "LandPlot", p.getId(), p.getCode());
        return toDto(p, context());
    }

    @Transactional
    public void delete(Long id) {
        LandPlot p = find(id);
        if (applications.existsByPlotId(id)) throw ApiException.conflict("Bu sahəyə müraciətlər var, silmək olmaz");
        if (!competitions.findByPlotId(id).isEmpty()) throw ApiException.conflict("Sahə müsabiqəyə daxildir, əvvəlcə müsabiqədən çıxarın");
        plots.delete(p);
        audit.log("PLOT_DELETED", "LandPlot", id, p.getCode());
    }

    private static void apply(LandPlot p, PlotRequest r) {
        p.setCode(r.code().trim());
        p.setCadastreNumber(r.cadastreNumber());
        p.setTitle(r.title());
        p.setDistrict(r.district());
        p.setVillage(r.village());
        p.setLatitude(r.latitude());
        p.setLongitude(r.longitude());
        p.setAreaHa(r.areaHa());
        p.setActivityType(r.activityType());
        p.setSoilType(r.soilType());
        p.setNitrogen(r.nitrogen());
        p.setPhosphorus(r.phosphorus());
        p.setPotassium(r.potassium());
        p.setPh(r.ph());
        p.setAvgTemperature(r.avgTemperature());
        p.setHumidity(r.humidity());
        p.setRainfall(r.rainfall());
        p.setWaterSourceKm(r.waterSourceKm());
        p.setRoadKm(r.roadKm());
        p.setIrrigationAvailable(r.irrigationAvailable());
        p.setElectricityAvailable(r.electricityAvailable());
        p.setMineClearance(r.mineClearance());
        p.setMineClearanceDate(r.mineClearanceDate());
        p.setLeaseYears(r.leaseYears());
        p.setMinInvestment(r.minInvestment());
        p.setUsageTerms(r.usageTerms());
        p.setDescription(r.description());
        if (r.status() != null) p.setStatus(r.status());
    }
}
