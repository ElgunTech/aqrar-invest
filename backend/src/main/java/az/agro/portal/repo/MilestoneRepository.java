package az.agro.portal.repo;

import az.agro.portal.domain.Milestone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {

    List<Milestone> findByApplicationIdOrderBySeq(Long applicationId);

    long countByApplicationId(Long applicationId);
}
