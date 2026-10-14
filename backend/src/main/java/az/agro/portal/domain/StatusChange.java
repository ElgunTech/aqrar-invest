package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

/** One entry of an application's history (status change, EKTİS event, applicant reply). */
@Entity
@Table(name = "status_change")
public class StatusChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private InvestmentApplication application;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ApplicationStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ApplicationStatus toStatus;

    @Column(name = "comment_text", length = 2000)
    private String comment;

    @Column(length = 150)
    private String changedBy;

    private Instant changedAt = Instant.now();

    protected StatusChange() {
    }

    public StatusChange(ApplicationStatus fromStatus, ApplicationStatus toStatus, String comment, String changedBy) {
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.comment = comment;
        this.changedBy = changedBy;
    }

    public Long getId() { return id; }
    public InvestmentApplication getApplication() { return application; }
    void setApplication(InvestmentApplication application) { this.application = application; }
    public ApplicationStatus getFromStatus() { return fromStatus; }
    public ApplicationStatus getToStatus() { return toStatus; }
    public String getComment() { return comment; }
    /** Only for the tamper demonstration: a direct edit that bypasses the ledger. */
    public void setComment(String comment) { this.comment = comment; }
    public String getChangedBy() { return changedBy; }
    public Instant getChangedAt() { return changedAt; }
    public void setChangedAt(Instant changedAt) { this.changedAt = changedAt; }
}
