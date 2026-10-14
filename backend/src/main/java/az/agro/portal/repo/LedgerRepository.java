package az.agro.portal.repo;

import az.agro.portal.domain.LedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LedgerRepository extends JpaRepository<LedgerEntry, Long> {

    Optional<LedgerEntry> findTopByOrderByIdDesc();

    List<LedgerEntry> findAllByOrderByIdAsc();

    List<LedgerEntry> findByApplicationNumberOrderByIdAsc(String applicationNumber);
}
