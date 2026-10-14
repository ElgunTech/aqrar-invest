package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * One commission member's independent score for an application. Each member scores once (and may revise it
 * until the decision); every score carries an explicit no-conflict-of-interest declaration.
 */
@Entity
@Table(name = "evaluator_score", uniqueConstraints = @UniqueConstraint(columnNames = {"application_id", "evaluator_id"}))
public class EvaluatorScore {

    public static final int MAX_PER_CRITERION = 10;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private InvestmentApplication application;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    private AppUser evaluator;

    /** Business plan feasibility, 0–10. */
    private int feasibility;
    /** Realism of the investment and financing, 0–10. */
    private int financing;
    /** Social impact: jobs, return of residents, 0–10. */
    private int socialImpact;
    /** Technology and sustainability (irrigation, yields), 0–10. */
    private int technology;

    @Column(name = "comment_text", length = 1000)
    private String comment;

    private boolean noConflictDeclared;

    private Instant updatedAt = Instant.now();

    protected EvaluatorScore() {
    }

    public EvaluatorScore(InvestmentApplication application, AppUser evaluator) {
        this.application = application;
        this.evaluator = evaluator;
    }

    /** Total on a 0–100 scale. */
    public int total() {
        return Math.round((feasibility + financing + socialImpact + technology) * 100f / (4 * MAX_PER_CRITERION));
    }

    public void update(int feasibility, int financing, int socialImpact, int technology, String comment) {
        this.feasibility = feasibility;
        this.financing = financing;
        this.socialImpact = socialImpact;
        this.technology = technology;
        this.comment = comment;
        this.noConflictDeclared = true;
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public InvestmentApplication getApplication() { return application; }
    public AppUser getEvaluator() { return evaluator; }
    public int getFeasibility() { return feasibility; }
    public int getFinancing() { return financing; }
    public int getSocialImpact() { return socialImpact; }
    public int getTechnology() { return technology; }
    public String getComment() { return comment; }
    public boolean isNoConflictDeclared() { return noConflictDeclared; }
    public Instant getUpdatedAt() { return updatedAt; }
}
