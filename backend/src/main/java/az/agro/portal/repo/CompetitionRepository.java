package az.agro.portal.repo;

import az.agro.portal.domain.Competition;
import az.agro.portal.domain.CompetitionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CompetitionRepository extends JpaRepository<Competition, Long> {

    List<Competition> findByStatusOrderByDeadlineAsc(CompetitionStatus status);

    List<Competition> findAllByOrderByCreatedAtDesc();

    @Query("select c from Competition c join c.plots p where p.id = :plotId order by c.deadline asc")
    List<Competition> findByPlotId(Long plotId);

    long countByStatus(CompetitionStatus status);
}
