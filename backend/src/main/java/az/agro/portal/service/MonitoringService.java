package az.agro.portal.service;

import az.agro.portal.domain.*;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.MilestoneRepository;
import az.agro.portal.security.CurrentUser;
import az.agro.portal.web.ApiException;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Post-award monitoring: the obligations a winning investor takes on, their reports and the ministry's review.
 * Most portals stop at the decision; the state's real risk (land that stays idle) begins after it.
 */
@Service
public class MonitoringService {

    /** Default obligation plan: months after the award, title, cumulative share of the planned investment. */
    private static final Object[][] PLAN = {
            {6, "Torpağın hazırlanması və suvarma infrastrukturu", 20},
            {12, "İnvestisiyanın ən azı 50%-nin reallaşdırılması", 50},
            {24, "İstehsala başlanması, ilk məhsul", 80},
            {36, "Layihənin tam gücə çıxması", 100},
    };

    public record MilestoneDto(Long id, int seq, String title, int investmentPercent, long expectedInvestment, LocalDate dueDate,
                               String status, String light, long daysLeft, String reportText, Long reportedInvestment,
                               boolean hasPhoto, Double photoLat, Double photoLng, Boolean gpsInsidePlot, Integer gpsDistanceM,
                               Instant reportedAt, String reviewNote, String reviewedBy) {
    }

    public record ProjectDto(Long applicationId, String applicationNumber, String applicantName, Long plotId, String plotCode, String plotTitle,
                             String district, long plannedInvestment, String light, int accepted, int total,
                             List<MilestoneDto> milestones) {
    }

    private final MilestoneRepository milestones;
    private final ApplicationRepository applications;
    private final FileStorageService files;
    private final CurrentUser currentUser;
    private final NotificationService notifications;
    private final AuditService audit;

    public MonitoringService(MilestoneRepository milestones, ApplicationRepository applications, FileStorageService files,
                             CurrentUser currentUser, NotificationService notifications, AuditService audit) {
        this.milestones = milestones;
        this.applications = applications;
        this.files = files;
        this.currentUser = currentUser;
        this.notifications = notifications;
        this.audit = audit;
    }

    /** Called when an application is approved: creates the obligation plan from the award date. */
    public void createPlan(InvestmentApplication a, LocalDate awardDate) {
        if (milestones.countByApplicationId(a.getId()) > 0) return;
        int seq = 1;
        for (Object[] p : PLAN) {
            milestones.save(new Milestone(a, seq++, (String) p[1], (Integer) p[2], awardDate.plusMonths((Integer) p[0])));
        }
    }

    // ------------------------------------------------------------ investor side

    @Transactional(readOnly = true)
    public ProjectDto mine(Long applicationId) {
        InvestmentApplication a = applications.findById(applicationId).orElseThrow(() -> ApiException.notFound("Müraciət"));
        if (!a.getApplicant().getId().equals(currentUser.require().getId())) throw ApiException.notFound("Müraciət");
        return toProject(a);
    }

    @Transactional
    public ProjectDto report(Long applicationId, Long milestoneId, String text, long investment, MultipartFile photo, Double lat, Double lng) {
        Milestone m = milestones.findById(milestoneId).filter(x -> x.getApplication().getId().equals(applicationId))
                .orElseThrow(() -> ApiException.notFound("Mərhələ"));
        InvestmentApplication a = m.getApplication();
        if (!a.getApplicant().getId().equals(currentUser.require().getId())) throw ApiException.notFound("Mərhələ");
        if (m.getStatus() == Milestone.Status.ACCEPTED) throw ApiException.conflict("Bu mərhələ artıq qəbul edilib");
        if (text == null || text.isBlank()) throw ApiException.badRequest("Hesabatın mətni tələb olunur");
        if (photo == null || photo.isEmpty()) throw ApiException.badRequest("Sahədən foto əlavə edin");
        FileStorageService.StoredFile f = files.store(photo);
        Boolean inside = null;
        Integer distance = null;
        if (lat != null && lng != null) {
            distance = (int) Math.round(distanceM(lat, lng, a.getPlot().getLatitude(), a.getPlot().getLongitude()));
            double radius = Math.sqrt(a.getPlot().getAreaHa() * 10_000 / Math.PI);
            inside = distance <= radius + 150; // GPS tolerance
        }
        m.report(text.trim(), investment, f.storedName(), f.originalName(), lat, lng, inside, distance);
        audit.log("MILESTONE_REPORTED", "Milestone", m.getId(), a.getApplicationNumber() + " #" + m.getSeq()
                + (inside == null ? " (GPS yoxdur)" : inside ? " (GPS sahə daxilində)" : " (GPS sahədən kənarda: " + distance + " m)"));
        return toProject(a);
    }

    // ------------------------------------------------------------ ministry side

    @Transactional(readOnly = true)
    public List<ProjectDto> portfolio() {
        return applications.findAllByOrderByCreatedAtDesc().stream()
                .filter(a -> a.getStatus() == ApplicationStatus.APPROVED)
                .map(this::toProject)
                .sorted(Comparator.comparingInt((ProjectDto p) -> switch (p.light()) {
                    case "red" -> 0;
                    case "yellow" -> 1;
                    default -> 2;
                }))
                .toList();
    }

    @Transactional
    public ProjectDto review(Long milestoneId, boolean accepted, String note) {
        Milestone m = milestones.findById(milestoneId).orElseThrow(() -> ApiException.notFound("Mərhələ"));
        if (m.getStatus() != Milestone.Status.REPORTED) throw ApiException.conflict("Mərhələ üzrə yoxlanılacaq hesabat yoxdur");
        if (!accepted && (note == null || note.isBlank())) throw ApiException.badRequest("Geri qaytarma səbəbini yazın");
        AppUser me = currentUser.require();
        m.review(accepted, note, me.getFullName());
        InvestmentApplication a = m.getApplication();
        notifications.notify(a.getApplicant(), (accepted ? "Hesabat qəbul edildi: " : "Hesabat geri qaytarıldı: ") + m.getTitle(),
                note == null || note.isBlank() ? "Mərhələ icra olunmuş hesab edildi." : note, "/kabinet/" + a.getId());
        audit.log(accepted ? "MILESTONE_ACCEPTED" : "MILESTONE_RETURNED", "Milestone", m.getId(), a.getApplicationNumber() + " #" + m.getSeq());
        return toProject(a);
    }

    @Transactional(readOnly = true)
    public ApplicationService.DocumentFile photo(Long milestoneId) {
        Milestone m = milestones.findById(milestoneId).orElseThrow(() -> ApiException.notFound("Mərhələ"));
        AppUser me = currentUser.require();
        if (me.getRole() == Role.INVESTOR && !m.getApplication().getApplicant().getId().equals(me.getId())) throw ApiException.notFound("Foto");
        if (m.getPhotoStoredName() == null) throw ApiException.notFound("Foto");
        Resource r = files.load(m.getPhotoStoredName());
        String type = m.getPhotoStoredName().endsWith(".png") ? "image/png" : "image/jpeg";
        return new ApplicationService.DocumentFile(r, m.getPhotoOriginalName(), type);
    }

    // ------------------------------------------------------------ mapping

    private ProjectDto toProject(InvestmentApplication a) {
        List<MilestoneDto> list = milestones.findByApplicationIdOrderBySeq(a.getId()).stream().map(m -> toDto(m, a)).toList();
        String light = list.stream().anyMatch(m -> m.light().equals("red")) ? "red"
                : list.stream().anyMatch(m -> m.light().equals("yellow")) ? "yellow" : "green";
        int accepted = (int) list.stream().filter(m -> m.status().equals("ACCEPTED")).count();
        return new ProjectDto(a.getId(), a.getApplicationNumber(), a.getApplicantName(), a.getPlot().getId(), a.getPlot().getCode(), a.getPlot().getTitle(),
                a.getPlot().getDistrict(), a.getPlannedInvestment(), light, accepted, list.size(), list);
    }

    private static MilestoneDto toDto(Milestone m, InvestmentApplication a) {
        long days = ChronoUnit.DAYS.between(LocalDate.now(ZoneId.systemDefault()), m.getDueDate());
        String light;
        if (m.getStatus() == Milestone.Status.ACCEPTED) light = "green";
        else if (m.isOverdue() || Boolean.FALSE.equals(m.getGpsInsidePlot())) light = "red";
        else if (m.getStatus() == Milestone.Status.REPORTED || days <= 45) light = "yellow";
        else light = "grey";
        return new MilestoneDto(m.getId(), m.getSeq(), m.getTitle(), m.getInvestmentPercent(),
                a.getPlannedInvestment() * m.getInvestmentPercent() / 100, m.getDueDate(), m.getStatus().name(), light, days,
                m.getReportText(), m.getReportedInvestment(), m.getPhotoStoredName() != null, m.getPhotoLat(), m.getPhotoLng(),
                m.getGpsInsidePlot(), m.getGpsDistanceM(), m.getReportedAt(), m.getReviewNote(), m.getReviewedBy());
    }

    private static double distanceM(double lat1, double lng1, double lat2, double lng2) {
        double r = 6_371_000;
        double dLat = Math.toRadians(lat2 - lat1), dLng = Math.toRadians(lng2 - lng1);
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * r * Math.asin(Math.sqrt(h));
    }
}
