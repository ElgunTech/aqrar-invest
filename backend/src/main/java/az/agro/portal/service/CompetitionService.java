package az.agro.portal.service;

import az.agro.portal.domain.*;
import az.agro.portal.dto.CompetitionDtos.*;
import az.agro.portal.dto.Labels;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.security.CurrentUser;
import az.agro.portal.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Competition lifecycle: DRAFT → PENDING_APPROVAL → PUBLISHED → CLOSED.
 * Publishing uses a maker-checker rule: an ADMIN other than the author must approve.
 */
@Service
public class CompetitionService {

    private final CompetitionRepository competitions;
    private final LandPlotRepository plots;
    private final ApplicationRepository applications;
    private final CurrentUser currentUser;
    private final AuditService audit;
    private final IntegrationService integration;

    public CompetitionService(CompetitionRepository competitions, LandPlotRepository plots, ApplicationRepository applications,
                              CurrentUser currentUser, AuditService audit, IntegrationService integration) {
        this.competitions = competitions;
        this.plots = plots;
        this.applications = applications;
        this.currentUser = currentUser;
        this.audit = audit;
        this.integration = integration;
    }

    @Transactional(readOnly = true)
    public List<CompetitionDto> listPublic() {
        return competitions.findByStatusOrderByDeadlineAsc(CompetitionStatus.PUBLISHED).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public CompetitionDto getPublic(Long id) {
        Competition c = find(id);
        if (c.getStatus() != CompetitionStatus.PUBLISHED && c.getStatus() != CompetitionStatus.CLOSED) {
            throw ApiException.notFound("Müsabiqə");
        }
        return toDto(c);
    }

    @Transactional(readOnly = true)
    public List<CompetitionDto> listAll() {
        return competitions.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).toList();
    }

    @Transactional
    public CompetitionDto create(CompetitionRequest r) {
        Competition c = new Competition();
        c.setCode(nextCode());
        c.setCreatedBy(currentUser.require());
        apply(c, r);
        competitions.save(c);
        audit.log("COMPETITION_CREATED", "Competition", c.getId(), c.getCode() + " — " + c.getTitle());
        return toDto(c);
    }

    @Transactional
    public CompetitionDto update(Long id, CompetitionRequest r) {
        Competition c = find(id);
        if (c.getStatus() != CompetitionStatus.DRAFT) throw ApiException.conflict("Yalnız qaralama redaktə oluna bilər");
        apply(c, r);
        audit.log("COMPETITION_UPDATED", "Competition", c.getId(), c.getCode());
        return toDto(c);
    }

    @Transactional
    public CompetitionDto submitForApproval(Long id) {
        Competition c = find(id);
        if (c.getStatus() != CompetitionStatus.DRAFT) throw ApiException.conflict("Yalnız qaralama təsdiqə göndərilə bilər");
        c.setStatus(CompetitionStatus.PENDING_APPROVAL);
        c.setReviewNote(null);
        audit.log("COMPETITION_SUBMITTED", "Competition", c.getId(), c.getCode());
        return toDto(c);
    }

    @Transactional
    public CompetitionDto approve(Long id, String note) {
        Competition c = find(id);
        AppUser approver = currentUser.require();
        if (approver.getRole() != Role.ADMIN) throw ApiException.forbidden("Müsabiqəni yalnız administrator təsdiq edə bilər");
        if (c.getStatus() != CompetitionStatus.PENDING_APPROVAL) throw ApiException.conflict("Müsabiqə təsdiq gözləmir");
        if (c.getCreatedBy() != null && c.getCreatedBy().getId().equals(approver.getId())) {
            throw ApiException.forbidden("Dörd göz prinsipi: müsabiqəni yaradan şəxs onu təsdiq edə bilməz");
        }
        if (c.getDeadline().isBefore(LocalDate.now())) throw ApiException.conflict("Son müraciət tarixi keçib");
        c.setStatus(CompetitionStatus.PUBLISHED);
        c.setApprovedBy(approver);
        c.setApprovedAt(Instant.now());
        c.setReviewNote(note);
        if (c.getStartDate() == null) c.setStartDate(LocalDate.now());
        c.getPlots().forEach(p -> p.setStatus(PlotStatus.IN_COMPETITION));
        audit.log("COMPETITION_APPROVED", "Competition", c.getId(), c.getCode());
        integration.enqueueCompetitionPublished(c);
        return toDto(c);
    }

    @Transactional
    public CompetitionDto reject(Long id, String note) {
        Competition c = find(id);
        if (currentUser.require().getRole() != Role.ADMIN) throw ApiException.forbidden("Yalnız administrator geri qaytara bilər");
        if (c.getStatus() != CompetitionStatus.PENDING_APPROVAL) throw ApiException.conflict("Müsabiqə təsdiq gözləmir");
        c.setStatus(CompetitionStatus.DRAFT);
        c.setReviewNote(note);
        audit.log("COMPETITION_RETURNED", "Competition", c.getId(), note);
        return toDto(c);
    }

    @Transactional
    public CompetitionDto close(Long id) {
        Competition c = find(id);
        if (c.getStatus() != CompetitionStatus.PUBLISHED) throw ApiException.conflict("Yalnız elan edilmiş müsabiqə bağlana bilər");
        c.setStatus(CompetitionStatus.CLOSED);
        audit.log("COMPETITION_CLOSED", "Competition", c.getId(), c.getCode());
        return toDto(c);
    }

    Competition find(Long id) {
        return competitions.findById(id).orElseThrow(() -> ApiException.notFound("Müsabiqə"));
    }

    private void apply(Competition c, CompetitionRequest r) {
        c.setTitle(r.title());
        c.setDescription(r.description());
        c.setRequirements(r.requirements());
        c.setStartDate(r.startDate());
        c.setDeadline(r.deadline());
        List<LandPlot> selected = plots.findAllById(r.plotIds());
        if (selected.size() != r.plotIds().stream().distinct().count()) throw ApiException.badRequest("Bəzi sahələr tapılmadı");
        if (selected.stream().anyMatch(p -> p.getStatus() == PlotStatus.ASSIGNED)) {
            throw ApiException.badRequest("Artıq təhvil verilmiş sahə müsabiqəyə daxil edilə bilməz");
        }
        c.getPlots().clear();
        c.getPlots().addAll(selected);
    }

    private String nextCode() {
        return "MQ-" + LocalDate.now().getYear() + "-" + String.format("%03d", competitions.count() + 1);
    }

    CompetitionDto toDto(Competition c) {
        long daysLeft = Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), c.getDeadline()));
        return new CompetitionDto(c.getId(), c.getCode(), c.getTitle(), c.getDescription(), c.getRequirements(),
                c.getStartDate(), c.getDeadline(), daysLeft, c.isOpen(), Labels.of(c.getStatus()),
                c.getPlots().stream().map(p -> new PlotRef(p.getId(), p.getCode(), p.getTitle(), p.getDistrict(), p.getAreaHa(),
                        p.getActivityType().getLabel())).toList(),
                c.getCreatedBy() == null ? null : c.getCreatedBy().getFullName(),
                c.getApprovedBy() == null ? null : c.getApprovedBy().getFullName(),
                c.getApprovedAt(), c.getReviewNote(), applications.countByCompetitionId(c.getId()), c.getCreatedAt());
    }
}
