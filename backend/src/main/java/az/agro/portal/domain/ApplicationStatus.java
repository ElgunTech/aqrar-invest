package az.agro.portal.domain;

import java.util.Set;

/**
 * Application lifecycle. APPROVED and REJECTED are both "Qərar verilib" (decision made) states.
 */
public enum ApplicationStatus {
    SUBMITTED("Qəbul edilib"),
    UNDER_REVIEW("Baxılır"),
    INFO_REQUESTED("Əlavə məlumat tələb olunur"),
    APPROVED("Qərar verilib: təsdiq"),
    REJECTED("Qərar verilib: imtina");

    private final String label;

    ApplicationStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isFinal() {
        return this == APPROVED || this == REJECTED;
    }

    /** Transitions an evaluator may perform from this status. */
    public Set<ApplicationStatus> allowedNext() {
        return switch (this) {
            case SUBMITTED -> Set.of(UNDER_REVIEW, REJECTED);
            case UNDER_REVIEW -> Set.of(INFO_REQUESTED, APPROVED, REJECTED);
            case INFO_REQUESTED -> Set.of(UNDER_REVIEW, REJECTED);
            case APPROVED, REJECTED -> Set.of();
        };
    }

    public boolean canMoveTo(ApplicationStatus next) {
        return allowedNext().contains(next);
    }
}
