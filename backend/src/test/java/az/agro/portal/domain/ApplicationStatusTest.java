package az.agro.portal.domain;

import org.junit.jupiter.api.Test;

import static az.agro.portal.domain.ApplicationStatus.*;
import static org.assertj.core.api.Assertions.assertThat;

class ApplicationStatusTest {

    @Test
    void decisionsArePossibleOnlyAfterReview() {
        assertThat(SUBMITTED.canMoveTo(APPROVED)).isFalse();
        assertThat(SUBMITTED.canMoveTo(UNDER_REVIEW)).isTrue();
        assertThat(UNDER_REVIEW.canMoveTo(APPROVED)).isTrue();
        assertThat(UNDER_REVIEW.canMoveTo(INFO_REQUESTED)).isTrue();
    }

    @Test
    void finalStatusesAreTerminal() {
        assertThat(APPROVED.allowedNext()).isEmpty();
        assertThat(REJECTED.allowedNext()).isEmpty();
        assertThat(APPROVED.isFinal()).isTrue();
        assertThat(UNDER_REVIEW.isFinal()).isFalse();
    }
}
