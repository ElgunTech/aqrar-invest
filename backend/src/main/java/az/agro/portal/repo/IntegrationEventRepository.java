package az.agro.portal.repo;

import az.agro.portal.domain.IntegrationEvent;
import az.agro.portal.domain.IntegrationEventStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IntegrationEventRepository extends JpaRepository<IntegrationEvent, Long> {

    List<IntegrationEvent> findTop20ByDirectionAndStatusOrderByCreatedAtAsc(IntegrationEvent.Direction direction, IntegrationEventStatus status);

    List<IntegrationEvent> findTop200ByOrderByCreatedAtDesc();
}
