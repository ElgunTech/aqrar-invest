package az.agro.portal.repo;

import az.agro.portal.domain.StoredBlob;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredBlobRepository extends JpaRepository<StoredBlob, String> {
}
