package az.agro.portal.service;

import az.agro.portal.ai.CropCatalog;
import az.agro.portal.domain.*;
import az.agro.portal.dto.ApplicationDtos.*;
import az.agro.portal.dto.Labels;
import az.agro.portal.dto.PlotDtos;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
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

    public ApplicationService(ApplicationRepository applications, CompetitionRepository competitions, LandPlotRepository plots,
                              CurrentUser currentUser, FileStorageService files, ApplicationScorer scorer,
                              NotificationService notifications, IntegrationService integration, AuditService audit) {
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
        a.setPhone(r.phone());
        a.setEmail(r.email());
        a.setAddress(r.address());
        a.setActivityType(r.activityType());
        a.setPlannedCrop(r.plannedCrop() == null || r.plannedCrop().isBlank() ? null : r.plannedCrop().trim().toLowerCase(Locale.ROOT));
        a.setPlannedInvestment(r.plannedInvestment());
        a.setOwnFundsPercent(r.ownFundsPercent());
        a.setJobsCreated(r.jobsCreated());
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
                        || a.getApplicantName().toLowerCase(Locale.ROOT).contains(needle)
                        || (a.getApplicationNumber() != null && a.getApplicationNumber().toLowerCase(Locale.ROOT).contains(needle))
                        || a.getPlot().getCode().toLowerCase(Locale.ROOT).contains(needle))
                .map(this::toListItem)
                .toList();
    }

    @Transactional
    public ApplicationDto adminGet(Long id) {
        InvestmentApplication a = find(id);
        audit.log("PII_VIEWED", "InvestmentApplication", a.getId(), "Müraciətin şəxsi məlumatlarına baxış: " + a.getApplicationNumber());
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
        AppUser actor = currentUser.require();
        a.setStatus(to);
        if (to.isFinal()) a.setDecisionNote(comment);
        if (to == ApplicationStatus.APPROVED) a.getPlot().setStatus(PlotStatus.ASSIGNED);
        a.addHistory(new StatusChange(from, to, comment.isEmpty() ? null : comment, actor.getFullName()));

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

    private ApplicationListItem toListItem(InvestmentApplication a) {
        return new ApplicationListItem(a.getId(), a.getApplicationNumber(), a.getApplicantName(), Labels.maskTaxId(a.getTaxId()),
                a.getCompetition().getTitle(), a.getPlot().getCode(), a.getPlot().getTitle(), a.getPlot().getDistrict(),
                Labels.of(a.getActivityType()), a.getPlannedInvestment(), a.getAutoScore(),
                Labels.of(a.getStatus()), Labels.of(a.getEktisStatus()), a.getCreatedAt(), a.getUpdatedAt());
    }

    ApplicationDto toDto(InvestmentApplication a, boolean maskPii) {
        List<DocumentDto> docs = a.getDocuments().stream()
                .map(d -> new DocumentDto(d.getId(), Labels.of(d.getType()), d.getOriginalName(), d.getContentType(), d.getSizeBytes(), d.getUploadedAt()))
                .toList();
        List<HistoryDto> history = a.getHistory().stream()
                .map(h -> new HistoryDto(Labels.of(h.getFromStatus()), Labels.of(h.getToStatus()), h.getComment(), h.getChangedBy(), h.getChangedAt()))
                .toList();
        List<PlotDtos.Label> next = a.getStatus().allowedNext().stream()
                .sorted(Comparator.comparingInt(Enum::ordinal)).map(Labels::of).toList();
        return new ApplicationDto(a.getId(), a.getApplicationNumber(), Labels.of(a.getStatus()),
                a.getCompetition().getId(), a.getCompetition().getCode(), a.getCompetition().getTitle(),
                a.getPlot().getId(), a.getPlot().getCode(), a.getPlot().getTitle(), a.getPlot().getDistrict(),
                Labels.of(a.getApplicantType()), a.getApplicantName(),
                maskPii ? Labels.maskTaxId(a.getTaxId()) : a.getTaxId(), a.getPhone(), a.getEmail(), a.getAddress(),
                Labels.of(a.getActivityType()), a.getPlannedCrop(), a.getPlannedCrop() == null ? null : CropCatalog.nameAz(a.getPlannedCrop()),
                a.getPlannedInvestment(), a.getOwnFundsPercent(), a.getJobsCreated(), a.getProjectMonths(), a.getExperienceYears(),
                a.getBusinessPlan(), scorer.score(a), a.getDecisionNote(),
                Labels.of(a.getEktisStatus()), a.getEktisReference(), a.getCreatedAt(), a.getUpdatedAt(),
                docs, history, next);
    }
}
