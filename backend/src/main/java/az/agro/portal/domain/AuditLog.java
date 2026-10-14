package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

/** Append-only record of who did what — required for transparency and personal-data access tracking. */
@Entity
@Table(name = "audit_log", indexes = @Index(columnList = "createdAt"))
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 120)
    private String actor;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(length = 60)
    private String entityType;

    @Column(length = 40)
    private String entityId;

    @Column(length = 1000)
    private String details;

    @Column(length = 60)
    private String ipAddress;

    private Instant createdAt = Instant.now();

    protected AuditLog() {
    }

    public AuditLog(String actor, String action, String entityType, String entityId, String details, String ipAddress) {
        this.actor = actor;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.details = details;
        this.ipAddress = ipAddress;
    }

    public Long getId() { return id; }
    public String getActor() { return actor; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public String getDetails() { return details; }
    public String getIpAddress() { return ipAddress; }
    public Instant getCreatedAt() { return createdAt; }
}
