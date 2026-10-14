package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A post-award obligation of the winning investor (e.g. "50% of the investment within 12 months").
 * The investor reports progress with a geotagged photo; staff accept or return the report.
 */
@Entity
@Table(name = "milestone")
public class Milestone {

    public enum Status { PLANNED, REPORTED, ACCEPTED, REJECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private InvestmentApplication application;

    private int seq;

    @Column(nullable = false, length = 200)
    private String title;

    /** Cumulative share of the planned investment expected by the due date. */
    private int investmentPercent;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PLANNED;

    @Column(length = 2000)
    private String reportText;

    private Long reportedInvestment;

    @Column(length = 80)
    private String photoStoredName;

    @Column(length = 200)
    private String photoOriginalName;

    private Double photoLat;
    private Double photoLng;

    /** null = no coordinates supplied; true/false = inside / outside the plot boundary. */
    private Boolean gpsInsidePlot;

    private Integer gpsDistanceM;

    private Instant reportedAt;

    @Column(length = 1000)
    private String reviewNote;

    @Column(length = 150)
    private String reviewedBy;

    private Instant reviewedAt;

    protected Milestone() {
    }

    public Milestone(InvestmentApplication application, int seq, String title, int investmentPercent, LocalDate dueDate) {
        this.application = application;
        this.seq = seq;
        this.title = title;
        this.investmentPercent = investmentPercent;
        this.dueDate = dueDate;
    }

    public boolean isOverdue() {
        return status != Status.ACCEPTED && dueDate.isBefore(LocalDate.now());
    }

    public void report(String text, long investment, String storedName, String originalName, Double lat, Double lng,
                       Boolean inside, Integer distance) {
        this.reportText = text;
        this.reportedInvestment = investment;
        this.photoStoredName = storedName;
        this.photoOriginalName = originalName;
        this.photoLat = lat;
        this.photoLng = lng;
        this.gpsInsidePlot = inside;
        this.gpsDistanceM = distance;
        this.reportedAt = Instant.now();
        this.status = Status.REPORTED;
        this.reviewNote = null;
    }

    public void review(boolean accepted, String note, String by) {
        this.status = accepted ? Status.ACCEPTED : Status.REJECTED;
        this.reviewNote = note;
        this.reviewedBy = by;
        this.reviewedAt = Instant.now();
    }

    public Long getId() { return id; }
    public InvestmentApplication getApplication() { return application; }
    public int getSeq() { return seq; }
    public String getTitle() { return title; }
    public int getInvestmentPercent() { return investmentPercent; }
    public LocalDate getDueDate() { return dueDate; }
    public Status getStatus() { return status; }
    public String getReportText() { return reportText; }
    public Long getReportedInvestment() { return reportedInvestment; }
    public String getPhotoStoredName() { return photoStoredName; }
    public String getPhotoOriginalName() { return photoOriginalName; }
    public Double getPhotoLat() { return photoLat; }
    public Double getPhotoLng() { return photoLng; }
    public Boolean getGpsInsidePlot() { return gpsInsidePlot; }
    public Integer getGpsDistanceM() { return gpsDistanceM; }
    public Instant getReportedAt() { return reportedAt; }
    public void setReportedAt(Instant reportedAt) { this.reportedAt = reportedAt; }
    public String getReviewNote() { return reviewNote; }
    public String getReviewedBy() { return reviewedBy; }
    public Instant getReviewedAt() { return reviewedAt; }
}
