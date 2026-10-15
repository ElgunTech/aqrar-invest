package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** An entrepreneur's application to an investment competition for a specific plot. */
@Entity
@Table(name = "investment_application")
public class InvestmentApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Public registration number, e.g. QIM-2026-000042. */
    @Column(unique = true, length = 30)
    private String applicationNumber;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    private AppUser applicant;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    private Competition competition;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    private LandPlot plot;

    // --- Applicant details (snapshot at submission time) ---
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApplicantType applicantType;

    @Column(nullable = false, length = 200)
    private String applicantName;

    /** FİN or VÖEN. */
    @Convert(converter = az.agro.portal.security.PiiConverter.class)
    @Column(nullable = false, length = 200)
    private String taxId;

    @Convert(converter = az.agro.portal.security.PiiConverter.class)
    @Column(length = 200)
    private String phone;

    @Column(length = 120)
    private String email;

    @Convert(converter = az.agro.portal.security.PiiConverter.class)
    @Column(length = 1200)
    private String address;

    // --- Investment & business plan ---
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ActivityType activityType;

    @Column(length = 60)
    private String plannedCrop;

    private long plannedInvestment;
    private int ownFundsPercent;
    private int jobsCreated;
    /** Of the new jobs, how many go to former IDPs returning to the region (Great Return programme). */
    private int returneeJobs;
    private int projectMonths;
    private int experienceYears;

    @Column(length = 6000)
    private String businessPlan;

    // --- Processing ---
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApplicationStatus status = ApplicationStatus.SUBMITTED;

    /** Automatic pre-evaluation score 0..100 (decision support only). */
    private int autoScore;

    @Column(length = 2000)
    private String decisionNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EktisSyncStatus ektisStatus = EktisSyncStatus.NOT_SENT;

    @Column(length = 60)
    private String ektisReference;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("uploadedAt")
    private List<ApplicationDocument> documents = new ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("changedAt")
    private List<StatusChange> history = new ArrayList<>();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public void addDocument(ApplicationDocument doc) {
        doc.setApplication(this);
        documents.add(doc);
    }

    public void addHistory(StatusChange change) {
        change.setApplication(this);
        history.add(change);
    }

    public Long getId() { return id; }
    public String getApplicationNumber() { return applicationNumber; }
    public void setApplicationNumber(String applicationNumber) { this.applicationNumber = applicationNumber; }
    public AppUser getApplicant() { return applicant; }
    public void setApplicant(AppUser applicant) { this.applicant = applicant; }
    public Competition getCompetition() { return competition; }
    public void setCompetition(Competition competition) { this.competition = competition; }
    public LandPlot getPlot() { return plot; }
    public void setPlot(LandPlot plot) { this.plot = plot; }
    public ApplicantType getApplicantType() { return applicantType; }
    public void setApplicantType(ApplicantType applicantType) { this.applicantType = applicantType; }
    public String getApplicantName() { return applicantName; }
    public void setApplicantName(String applicantName) { this.applicantName = applicantName; }
    public String getTaxId() { return taxId; }
    public void setTaxId(String taxId) { this.taxId = taxId; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public ActivityType getActivityType() { return activityType; }
    public void setActivityType(ActivityType activityType) { this.activityType = activityType; }
    public String getPlannedCrop() { return plannedCrop; }
    public void setPlannedCrop(String plannedCrop) { this.plannedCrop = plannedCrop; }
    public long getPlannedInvestment() { return plannedInvestment; }
    public void setPlannedInvestment(long plannedInvestment) { this.plannedInvestment = plannedInvestment; }
    public int getOwnFundsPercent() { return ownFundsPercent; }
    public void setOwnFundsPercent(int ownFundsPercent) { this.ownFundsPercent = ownFundsPercent; }
    public int getJobsCreated() { return jobsCreated; }
    public void setJobsCreated(int jobsCreated) { this.jobsCreated = jobsCreated; }
    public int getReturneeJobs() { return returneeJobs; }
    public void setReturneeJobs(int returneeJobs) { this.returneeJobs = returneeJobs; }
    public int getProjectMonths() { return projectMonths; }
    public void setProjectMonths(int projectMonths) { this.projectMonths = projectMonths; }
    public int getExperienceYears() { return experienceYears; }
    public void setExperienceYears(int experienceYears) { this.experienceYears = experienceYears; }
    public String getBusinessPlan() { return businessPlan; }
    public void setBusinessPlan(String businessPlan) { this.businessPlan = businessPlan; }
    public ApplicationStatus getStatus() { return status; }
    public void setStatus(ApplicationStatus status) { this.status = status; }
    public int getAutoScore() { return autoScore; }
    public void setAutoScore(int autoScore) { this.autoScore = autoScore; }
    public String getDecisionNote() { return decisionNote; }
    public void setDecisionNote(String decisionNote) { this.decisionNote = decisionNote; }
    public EktisSyncStatus getEktisStatus() { return ektisStatus; }
    public void setEktisStatus(EktisSyncStatus ektisStatus) { this.ektisStatus = ektisStatus; }
    public String getEktisReference() { return ektisReference; }
    public void setEktisReference(String ektisReference) { this.ektisReference = ektisReference; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<ApplicationDocument> getDocuments() { return documents; }
    public List<StatusChange> getHistory() { return history; }
}
