package az.agro.portal.service;

import az.agro.portal.ai.CropCatalog;
import az.agro.portal.domain.*;
import az.agro.portal.dto.ApplicationDtos.*;
import az.agro.portal.dto.Labels;
import az.agro.portal.dto.PlotDtos;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
import az.agro.portal.repo.EvaluatorScoreRepository;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.security.CurrentUser;
import az.agro.portal.web.ApiException;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.*;

@Service
public class ApplicationService {

    private final ApplicationRepository applications;
    private final CompetitionRepository competitions;
    private final LandPlotRepository plots;
    private final CurrentUser currentUser;
    private final FileStorageService files;
    private final ApplicationScorer scorer;
    private final NotificationService notifications;
    private final IntegrationService integration;
    private final AuditService audit;
    private final EvaluatorScoreRepository scores;
    private final MonitoringService monitoring;
    private final IntegrityService integrity;
    private LedgerService ledger;

    /** Minimum number of independent commission scores before an application can be approved. */
    public static final int REQUIRED_SCORES = 2;

    @org.springframework.beans.factory.annotation.Autowired
    void setLedger(LedgerService ledger) { this.ledger = ledger; }

    public ApplicationService(IntegrityService integrity, MonitoringService monitoring, EvaluatorScoreRepository scores, ApplicationRepository applications, CompetitionRepository competitions, LandPlotRepository plots,
                              CurrentUser currentUser, FileStorageService files, ApplicationScorer scorer,
                              NotificationService notifications, IntegrationService integration, AuditService audit) {
        this.scores = scores;
        this.monitoring = monitoring;
        this.integrity = integrity;
        this.applications = applications;
        this.competitions = competitions;
        this.plots = plots;
        this.currentUser = currentUser;
        this.files = files;
        this.scorer = scorer;
        this.notifications = notifications;
        this.integration = integration;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ applicant side

    @Transactional
    public SubmitResult submit(ApplicationRequest r, List<MultipartFile> uploads, List<DocumentType> types) {
        AppUser user = currentUser.require();
        if (user.getRole() != Role.INVESTOR) throw ApiException.forbidden("Müraciəti yalnız sahibkar hesabı ilə vermək olar");

        Competition c = competitions.findById(r.competitionId()).orElseThrow(() -> ApiException.notFound("Müsabiqə"));
        if (!c.isOpen()) throw ApiException.conflict("Bu müsabiqə üzrə müraciət qəbulu bağlıdır");
        LandPlot plot = plots.findById(r.plotId()).orElseThrow(() -> ApiException.notFound("Sahə"));
        if (c.getPlots().stream().noneMatch(p -> p.getId().equals(plot.getId()))) {
            throw ApiException.badRequest("Seçilmiş sahə bu müsabiqəyə daxil deyil");
        }
        if (applications.existsByApplicantIdAndCompetitionIdAndPlotId(user.getId(), c.getId(), plot.getId())) {
            throw ApiException.conflict("Bu sahə üçün artıq müraciət etmisiniz");
        }

        List<MultipartFile> docs = uploads == null ? List.of() : uploads;
        List<DocumentType> docTypes = types == null ? List.of() : types;
        if (docs.size() != docTypes.size()) throw ApiException.badRequest("Hər sənəd üçün növ göstərilməlidir");
        Set<DocumentType> present = EnumSet.noneOf(DocumentType.class);
        present.addAll(docTypes);
        List<String> missing = new ArrayList<>();
        if (!present.contains(DocumentType.BUSINESS_PLAN)) missing.add(DocumentType.BUSINESS_PLAN.getLabel());
        if (!present.contains(DocumentType.ID_DOCUMENT)) missing.add(DocumentType.ID_DOCUMENT.getLabel());
        validateIdentity(r);
        if (r.applicantType() == ApplicantType.COMPANY && !present.contains(DocumentType.REGISTRATION_CERT)) {
            missing.add(DocumentType.REGISTRATION_CERT.getLabel());
        }
        if (!missing.isEmpty()) throw ApiException.badRequest("Çatışmayan sənədlər: " + String.join(", ", missing));

        InvestmentApplication a = new InvestmentApplication();
        a.setApplicant(user);
        a.setCompetition(c);
        a.setPlot(plot);
        a.setApplicantType(r.applicantType());
        a.setApplicantName(r.applicantName().trim());
        a.setTaxId(r.taxId().trim().toUpperCase(Locale.ROOT));
        a.setCitizenship(r.applicantType() == ApplicantType.FOREIGN ? r.citizenship().trim() : null);
        a.setPhone(r.phone());
        a.setEmail(r.email());
        a.setAddress(r.address());
        a.setActivityType(r.activityType());
        a.setPlannedCrop(r.plannedCrop() == null || r.plannedCrop().isBlank() ? null : r.plannedCrop().trim().toLowerCase(Locale.ROOT));
        a.setPlannedInvestment(r.plannedInvestment());
        a.setOwnFundsPercent(r.ownFundsPercent());
        a.setJobsCreated(r.jobsCreated());
        if (r.returneeJobs() > r.jobsCreated()) throw ApiException.badRequest("Qayıdan sakinlər üçün iş yerləri ümumi iş yerlərindən çox ola bilməz");
        a.setReturneeJobs(r.returneeJobs());
        a.setProjectMonths(r.projectMonths());
        a.setExperienceYears(r.experienceYears());
        a.setBusinessPlan(r.businessPlan());
        a.setStatus(ApplicationStatus.SUBMITTED);
        for (int i = 0; i < docs.size(); i++) {
            FileStorageService.StoredFile f = files.store(docs.get(i));
            a.addDocument(new ApplicationDocument(docTypes.get(i), f.originalName(), f.storedName(), f.contentType(), f.size()));
        }
        a.addHistory(new StatusChange(null, ApplicationStatus.SUBMITTED, "Müraciət elektron qaydada qəbul edildi", user.getFullName()));
        a.setAutoScore(scorer.score(a).total());
        applications.save(a);
        a.setApplicationNumber(String.format("QIM-%d-%06d", LocalDate.now().getYear(), a.getId()));
        a.getHistory().forEach(h -> ledger.status(a, h));

        notifications.notify(user, "Müraciətiniz qəbul edildi: " + a.getApplicationNumber(),
                plot.getTitle() + " sahəsi üzrə müraciətiniz qeydə alındı. Statusu şəxsi kabinetdən izləyə bilərsiniz.",
                "/kabinet/" + a.getId());
        integration.enqueueApplicationSubmitted(a);
        audit.log("APPLICATION_SUBMITTED", "InvestmentApplication", a.getId(), a.getApplicationNumber());
        return new SubmitResult(a.getId(), a.getApplicationNumber(), Labels.of(a.getStatus()), a.getAutoScore());
    }

    @Transactional(readOnly = true)
    public List<ApplicationListItem> mine() {
        return applications.findByApplicantIdOrderByCreatedAtDesc(currentUser.require().getId()).stream().map(this::toListItem).toList();
    }

    @Transactional(readOnly = true)
    public ApplicationDto mine(Long id) {
        InvestmentApplication a = find(id);
        requireOwner(a);
        return toDto(a, false);
    }

    /** Applicant answers an "additional information requested" step; the application goes back to review. */
    @Transactional
    public ApplicationDto reply(Long id, String comment, List<MultipartFile> uploads, List<DocumentType> types) {
        InvestmentApplication a = find(id);
        requireOwner(a);
        if (a.getStatus() != ApplicationStatus.INFO_REQUESTED) throw ApiException.conflict("Hazırda əlavə məlumat tələb olunmur");
        List<MultipartFile> docs = uploads == null ? List.of() : uploads;
        List<DocumentType> docTypes = types == null ? List.of() : types;
        if (docs.size() != docTypes.size()) throw ApiException.badRequest("Hər sənəd üçün növ göstərilməlidir");
        for (int i = 0; i < docs.size(); i++) {
            FileStorageService.StoredFile f = files.store(docs.get(i));
            a.addDocument(new ApplicationDocument(docTypes.get(i), f.originalName(), f.storedName(), f.contentType(), f.size()));
        }
        ApplicationStatus from = a.getStatus();
        a.setStatus(ApplicationStatus.UNDER_REVIEW);
        a.addHistory(new StatusChange(from, ApplicationStatus.UNDER_REVIEW,
                "Sahibkarın cavabı: " + comment + (docs.isEmpty() ? "" : " (" + docs.size() + " sənəd əlavə edildi)"),
                a.getApplicant().getFullName()));
        ledger.status(a, a.getHistory().get(a.getHistory().size() - 1));
        integration.enqueueStatusChanged(a, from, ApplicationStatus.UNDER_REVIEW, "Applicant provided additional information");
        audit.log("APPLICATION_REPLIED", "InvestmentApplication", a.getId(), a.getApplicationNumber());
        return toDto(a, false);
    }

    // ------------------------------------------------------------------ evaluator side

    @Transactional(readOnly = true)
    public List<ApplicationListItem> adminList(ApplicationStatus status, Long competitionId, String q) {
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        return applications.findAllByOrderByCreatedAtDesc().stream()
                .filter(a -> status == null || a.getStatus() == status)
                .filter(a -> competitionId == null || a.getCompetition().getId().equals(competitionId))
                .filter(a -> needle.isEmpty()
                        || (!blind(a) && a.getApplicantName().toLowerCase(Locale.ROOT).contains(needle))
                        || (a.getApplicationNumber() != null && a.getApplicationNumber().toLowerCase(Locale.ROOT).contains(needle))
                        || a.getPlot().getCode().toLowerCase(Locale.ROOT).contains(needle))
                .map(this::toListItem)
                .toList();
    }

    /** FİN for citizens, VÖEN for companies, passport number + citizenship for foreign citizens. */
    static void validateIdentity(ApplicationRequest r) {
        String id = r.taxId().trim();
        switch (r.applicantType()) {
            case INDIVIDUAL -> { if (!id.matches("[A-Za-z0-9]{7}")) throw ApiException.badRequest("FİN 7 simvoldan ibarət olmalıdır"); }
            case COMPANY -> { if (!id.matches("\\d{10}")) throw ApiException.badRequest("VÖEN 10 rəqəmdən ibarət olmalıdır"); }
            case FOREIGN -> {
                if (!id.matches("[A-Za-z0-9]{6,12}")) throw ApiException.badRequest("Pasport nömrəsi 6–12 hərf və rəqəmdən ibarət olmalıdır");
                if (r.citizenship() == null || r.citizenship().isBlank()) throw ApiException.badRequest("Vətəndaşlığı göstərin");
            }
        }
    }

    @Transactional
    public ApplicationDto adminGet(Long id) {
        InvestmentApplication a = find(id);
        if (!blind(a)) audit.log("PII_VIEWED", "InvestmentApplication", a.getId(), "Müraciətin şəxsi məlumatlarına baxış: " + a.getApplicationNumber());
        return toDto(a, false);
    }

    @Transactional
    public ApplicationDto changeStatus(Long id, StatusChangeRequest r) {
        InvestmentApplication a = find(id);
        ApplicationStatus from = a.getStatus();
        ApplicationStatus to = r.status();
        if (!from.canMoveTo(to)) {
            throw ApiException.conflict("\"" + from.getLabel() + "\" statusundan \"" + to.getLabel() + "\" statusuna keçid mümkün deyil");
        }
        String comment = r.comment() == null ? "" : r.comment().trim();
        if ((to == ApplicationStatus.INFO_REQUESTED || to.isFinal()) && comment.isEmpty()) {
            throw ApiException.badRequest("Bu status üçün şərh (səbəb) yazılmalıdır");
        }
        if (to == ApplicationStatus.APPROVED && applications.existsByPlotIdAndCompetitionIdAndStatusAndIdNot(
                a.getPlot().getId(), a.getCompetition().getId(), ApplicationStatus.APPROVED, a.getId())) {
            throw ApiException.conflict("Bu sahə üzrə artıq qalib müəyyən edilib");
        }
        if (to == ApplicationStatus.APPROVED && scores.countByApplicationId(a.getId()) < REQUIRED_SCORES) {
            throw ApiException.conflict("Təsdiq üçün ən azı " + REQUIRED_SCORES + " komissiya üzvünün müstəqil balı lazımdır");
        }
        AppUser actor = currentUser.require();
        a.setStatus(to);
        if (to.isFinal()) a.setDecisionNote(comment);
        if (to == ApplicationStatus.APPROVED) {
            a.getPlot().setStatus(PlotStatus.ASSIGNED);
            monitoring.createPlan(a, LocalDate.now());
        }
        a.addHistory(new StatusChange(from, to, comment.isEmpty() ? null : comment, actor.getFullName()));
        ledger.status(a, a.getHistory().get(a.getHistory().size() - 1));

        String title = switch (to) {
            case UNDER_REVIEW -> "Müraciətinizə baxılır";
            case INFO_REQUESTED -> "Əlavə məlumat tələb olunur";
            case APPROVED -> "Təbrik edirik! Müraciətiniz təsdiq edildi";
            case REJECTED -> "Müraciət üzrə qərar verildi";
            case SUBMITTED -> "Müraciət statusu yeniləndi";
        };
        notifications.notify(a.getApplicant(), title + " — " + a.getApplicationNumber(),
                comment.isEmpty() ? "Yeni status: " + to.getLabel() : comment, "/kabinet/" + a.getId());
        integration.enqueueStatusChanged(a, from, to, comment);
        audit.log("APPLICATION_STATUS_CHANGED", "InvestmentApplication", a.getId(),
                a.getApplicationNumber() + ": " + from + " → " + to);
        return toDto(a, false);
    }

    // ------------------------------------------------------------------ commission

    @Transactional
    public ApplicationDto score(Long id, ScoreRequest r) {
        InvestmentApplication a = find(id);
        if (a.getStatus().isFinal()) throw ApiException.conflict("Qərar verilmiş müraciət yenidən qiymətləndirilə bilməz");
        if (!r.noConflict()) throw ApiException.badRequest("Maraqlar toqquşması olan üzv qiymətləndirmədə iştirak edə bilməz");
        AppUser me = currentUser.require();
        EvaluatorScore s = scores.findByApplicationIdAndEvaluatorId(a.getId(), me.getId()).orElseGet(() -> new EvaluatorScore(a, me));
        s.update(r.feasibility(), r.financing(), r.socialImpact(), r.technology(), r.comment());
        scores.save(s);
        ledger.score(a, s);
        audit.log("COMMISSION_SCORE", "InvestmentApplication", a.getId(), a.getApplicationNumber() + ": " + s.total() + "/100");
        return toDto(a, false);
    }

    private Commission commission(InvestmentApplication a) {
        AppUser viewer = currentUser.find().orElse(null);
        Long me = viewer == null ? -1L : viewer.getId();
        // Applicants see that independent scores exist, not who gave them or the internal remarks.
        boolean applicantView = viewer == null || viewer.getRole() == Role.INVESTOR;
        List<EvaluatorScore> raw = scores.findByApplicationIdOrderByUpdatedAtAsc(a.getId());
        List<CommissionScore> list = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) {
            EvaluatorScore s = raw.get(i);
            list.add(new CommissionScore(applicantView ? "Komissiya üzvü " + (i + 1) : s.getEvaluator().getFullName(),
                    s.getFeasibility(), s.getFinancing(), s.getSocialImpact(), s.getTechnology(), s.total(),
                    applicantView ? null : s.getComment(), s.getUpdatedAt(), s.getEvaluator().getId().equals(me)));
        }
        Integer avg = list.isEmpty() ? null : (int) Math.round(list.stream().mapToInt(CommissionScore::total).average().orElse(0));
        return new Commission(list, avg, REQUIRED_SCORES);
    }

    // ------------------------------------------------------------------ public receipt verification

    /** Anyone holding a receipt can confirm it is genuine. Personal data is reduced to initials. */
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> verify(String number) {
        InvestmentApplication a = applications.findByApplicationNumber(number.trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> ApiException.notFound("Müraciət"));
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("applicationNumber", a.getApplicationNumber());
        m.put("applicant", initials(a.getApplicantName()));
        m.put("competition", a.getCompetition().getTitle());
        m.put("plot", a.getPlot().getCode() + " · " + a.getPlot().getTitle());
        m.put("submittedAt", a.getCreatedAt().toString());
        m.put("status", Labels.of(a.getStatus()));
        m.put("ektisReference", a.getEktisReference());
        return m;
    }

    private static String initials(String name) {
        StringBuilder sb = new StringBuilder();
        for (String w : name.replace("\"", "").split("\\s+")) {
            if (w.isEmpty()) continue;
            if (sb.length() > 0) sb.append(" ");
            sb.append(w.charAt(0)).append("***");
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ documents

    public record DocumentFile(Resource resource, String fileName, String contentType) {
    }

    @Transactional
    public DocumentFile document(Long applicationId, Long documentId) {
        InvestmentApplication a = find(applicationId);
        AppUser user = currentUser.require();
        boolean staff = user.getRole() != Role.INVESTOR;
        if (!staff && !a.getApplicant().getId().equals(user.getId())) throw ApiException.notFound("Müraciət");
        ApplicationDocument d = a.getDocuments().stream().filter(x -> x.getId().equals(documentId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Sənəd"));
        if (staff && blind(a) && (d.getType() == DocumentType.ID_DOCUMENT || d.getType() == DocumentType.REGISTRATION_CERT)) {
            throw ApiException.forbidden("Kor qiymətləndirmə: şəxsiyyət sənədləri balınızı verdikdən sonra açılır");
        }
        if (staff) audit.log("DOCUMENT_DOWNLOADED", "ApplicationDocument", d.getId(), a.getApplicationNumber() + " / " + d.getOriginalName());
        return new DocumentFile(files.load(d.getStoredName()), d.getOriginalName(), d.getContentType());
    }

    // ------------------------------------------------------------------ mapping

    private InvestmentApplication find(Long id) {
        return applications.findById(id).orElseThrow(() -> ApiException.notFound("Müraciət"));
    }

    private void requireOwner(InvestmentApplication a) {
        // 404 instead of 403 so that application ids of other users cannot be probed
        if (!a.getApplicant().getId().equals(currentUser.require().getId())) throw ApiException.notFound("Müraciət");
    }

    /**
     * Blind evaluation: a staff member who has not yet scored an undecided application sees it without the applicant's
     * identity (name, FİN/VÖEN, contacts, identity documents). The identity opens once their own score is in, so the
     * score cannot depend on who the applicant is. Integrity signals stay visible: they refer to application numbers.
     */
    boolean blind(InvestmentApplication a) {
        AppUser viewer = currentUser.find().orElse(null);
        if (viewer == null || viewer.getRole() == Role.INVESTOR || a.getStatus().isFinal()) return false;
        return scores.findByApplicationIdAndEvaluatorId(a.getId(), viewer.getId()).isEmpty();
    }

    static String anonymous(InvestmentApplication a) {
        return "Müraciətçi A-" + String.format("%03d", a.getId());
    }

    private ApplicationListItem toListItem(InvestmentApplication a) {
        boolean blind = blind(a);
        return new ApplicationListItem(a.getId(), a.getApplicationNumber(), blind, blind ? anonymous(a) : a.getApplicantName(), blind ? "•••••••" : Labels.maskTaxId(a.getTaxId()),
                a.getCompetition().getTitle(), a.getPlot().getCode(), a.getPlot().getTitle(), a.getPlot().getDistrict(),
                Labels.of(a.getActivityType()), a.getPlannedInvestment(), a.getAutoScore(),
                currentUser.find().map(u -> u.getRole() != Role.INVESTOR).orElse(false) ? integrity.count(a) : 0,
                Labels.of(a.getStatus()), Labels.of(a.getEktisStatus()), a.getCreatedAt(), a.getUpdatedAt());
    }

    ApplicationDto toDto(InvestmentApplication a, boolean maskPii) {
        boolean blind = blind(a);
        String applicantName = a.getApplicantName();
        List<DocumentDto> docs = a.getDocuments().stream()
                .map(d -> new DocumentDto(d.getId(), Labels.of(d.getType()), blind ? d.getType().getLabel() : d.getOriginalName(), d.getContentType(), d.getSizeBytes(), d.getUploadedAt()))
                .toList();
        List<HistoryDto> history = a.getHistory().stream()
                .map(h -> new HistoryDto(Labels.of(h.getFromStatus()), Labels.of(h.getToStatus()), h.getComment(),
                        blind && (applicantName.equals(h.getChangedBy()) || a.getApplicant().getFullName().equals(h.getChangedBy())) ? anonymous(a) : h.getChangedBy(), h.getChangedAt()))
                .toList();
        List<PlotDtos.Label> next = a.getStatus().allowedNext().stream()
                .sorted(Comparator.comparingInt(Enum::ordinal)).map(Labels::of).toList();
        return new ApplicationDto(a.getId(), a.getApplicationNumber(), Labels.of(a.getStatus()),
                a.getCompetition().getId(), a.getCompetition().getCode(), a.getCompetition().getTitle(),
                a.getPlot().getId(), a.getPlot().getCode(), a.getPlot().getTitle(), a.getPlot().getDistrict(),
                blind, Labels.of(a.getApplicantType()), blind ? anonymous(a) : a.getApplicantName(),
                blind ? "•••••••" : maskPii ? Labels.maskTaxId(a.getTaxId()) : a.getTaxId(),
                blind ? null : a.getPhone(), blind ? null : a.getEmail(), blind ? null : a.getAddress(),
                Labels.of(a.getActivityType()), a.getPlannedCrop(), a.getPlannedCrop() == null ? null : CropCatalog.nameAz(a.getPlannedCrop()),
                a.getPlannedInvestment(), a.getOwnFundsPercent(), a.getJobsCreated(), a.getReturneeJobs(), a.getProjectMonths(), a.getExperienceYears(),
                a.getBusinessPlan(), scorer.score(a), commission(a),
                currentUser.find().filter(u -> u.getRole() != Role.INVESTOR).map(u -> integrity.signals(a, u)).orElse(List.of()),
                a.getDecisionNote(),
                Labels.of(a.getEktisStatus()), a.getEktisReference(), a.getCreatedAt(), a.getUpdatedAt(),
                docs, history, next);
    }
}
