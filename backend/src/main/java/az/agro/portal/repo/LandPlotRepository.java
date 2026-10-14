package az.agro.portal.repo;

import az.agro.portal.domain.LandPlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface LandPlotRepository extends JpaRepository<LandPlot, Long>, JpaSpecificationExecutor<LandPlot> {

    boolean existsByCode(String code);

    @Query("select distinct p.district from LandPlot p order by p.district")
    List<String> findDistricts();
}
