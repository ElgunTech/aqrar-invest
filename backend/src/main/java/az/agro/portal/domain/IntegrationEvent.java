package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Transactional outbox / inbox for EKTİS. Outbound events are written in the same DB transaction
 * as the business change and delivered asynchronously with retries, so no event is lost if EKTİS is down.
 */
@Entity
@Table(name = "integration_event", indexes = @Index(columnList = "status"))
public class IntegrationEvent {

    public enum Direction { OUTBOUND, INBOUND }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Direction direction;

    @Column(nullable = false, length = 60)
    private String eventType;

    @Column(length = 40)
    private String aggregateId;

    @Lob
    @Column(nullable = false)
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IntegrationEventStatus status;

    private int attempts;

    @Column(length = 1000)
    private String lastError;

    @Column(length = 60)
    private String externalReference;

    private Instant createdAt = Instant.now();
    private Instant processedAt;

    protected IntegrationEvent() {
    }

    public IntegrationEvent(Direction direction, String eventType, String aggregateId, String payload, IntegrationEventStatus status) {
        this.direction = direction;
        this.eventType = eventType;
        this.aggregateId = aggregateId;
        this.payload = payload;
        this.status = status;
    }

    public Long getId() { return id; }
    public Direction getDirection() { return direction; }
    public String getEventType() { return eventType; }
    public String getAggregateId() { return aggregateId; }
    public String getPayload() { return payload; }
    public IntegrationEventStatus getStatus() { return status; }
    public void setStatus(IntegrationEventStatus status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
    public String getExternalReference() { return externalReference; }
    public void setExternalReference(String externalReference) { this.externalReference = externalReference; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getProcessedAt() { return processedAt; }
    public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }
}
