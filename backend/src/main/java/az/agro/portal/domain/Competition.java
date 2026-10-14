package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

/** An investment competition. Publishing requires approval by a second person (maker-checker). */
@Entity
@Table(name = "competition")
public class Competition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 4000)
    private String description;

    @Column(length = 4000)
    private String requirements;

    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CompetitionStatus status = CompetitionStatus.DRAFT;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "competition_plot",
            joinColumns = @JoinColumn(name = "competition_id"),
            inverseJoinColumns = @JoinColumn(name = "plot_id"))
    @OrderBy("code")
    private Set<LandPlot> plots = new LinkedHashSet<>();

    @ManyToOne(fetch = FetchType.EAGER)
    private AppUser createdBy;

    @ManyToOne(fetch = FetchType.EAGER)
    private AppUser approvedBy;

    private Instant approvedAt;

    @Column(length = 1000)
    private String reviewNote;

    private Instant createdAt = Instant.now();

    public boolean isOpen() {
        return status == CompetitionStatus.PUBLISHED && !LocalDate.now().isAfter(deadline);
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRequirements() { return requirements; }
    public void setRequirements(String requirements) { this.requirements = requirements; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getDeadline() { return deadline; }
    public void setDeadline(LocalDate deadline) { this.deadline = deadline; }
    public CompetitionStatus getStatus() { return status; }
    public void setStatus(CompetitionStatus status) { this.status = status; }
    public Set<LandPlot> getPlots() { return plots; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public AppUser getApprovedBy() { return approvedBy; }
    public void setApprovedBy(AppUser approvedBy) { this.approvedBy = approvedBy; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public Instant getCreatedAt() { return createdAt; }
}
