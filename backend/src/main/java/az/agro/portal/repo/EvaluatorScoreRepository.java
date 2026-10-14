package az.agro.portal.repo;

import az.agro.portal.domain.EvaluatorScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvaluatorScoreRepository extends JpaRepository<EvaluatorScore, Long> {

    List<EvaluatorScore> findByApplicationIdOrderByUpdatedAtAsc(Long applicationId);

    Optional<EvaluatorScore> findByApplicationIdAndEvaluatorId(Long applicationId, Long evaluatorId);

    long countByApplicationId(Long applicationId);
}
