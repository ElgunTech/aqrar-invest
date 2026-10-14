package az.agro.portal.repo;

import az.agro.portal.domain.ApplicationStatus;
import az.agro.portal.domain.InvestmentApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<InvestmentApplication, Long> {

    List<InvestmentApplication> findByApplicantIdOrderByCreatedAtDesc(Long applicantId);

    List<InvestmentApplication> findAllByOrderByCreatedAtDesc();

    Optional<InvestmentApplication> findByApplicationNumber(String applicationNumber);

    boolean existsByApplicantIdAndCompetitionIdAndPlotId(Long applicantId, Long competitionId, Long plotId);

    boolean existsByPlotId(Long plotId);

    boolean existsByPlotIdAndCompetitionIdAndStatusAndIdNot(Long plotId, Long competitionId, ApplicationStatus status, Long id);

    long countByStatus(ApplicationStatus status);

    long countByCompetitionId(Long competitionId);

    long countByPlotId(Long plotId);

    @Query("select a.plot.id, count(a) from InvestmentApplication a group by a.plot.id")
    List<Object[]> countPerPlot();
}
