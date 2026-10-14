package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * One link of the decision ledger: a copy of a status change or a commission score, chained to the previous link by
 * SHA-256. Editing any stored decision afterwards (in the ledger or in the source tables) is detectable.
 */
@Entity
@Table(name = "ledger_entry", indexes = @Index(columnList = "applicationNumber"))
public class LedgerEntry {

    public enum Kind { STATUS, SCORE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String applicationNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Kind kind;

    @Lob
    @Column(nullable = false)
    private String payload;

    @Column(nullable = false, length = 64)
    private String prevHash;

    @Column(nullable = false, length = 64)
    private String hash;

    private Instant recordedAt = Instant.now();

    protected LedgerEntry() {
    }

    public LedgerEntry(String applicationNumber, Kind kind, String payload, String prevHash, String hash, Instant recordedAt) {
        this.applicationNumber = applicationNumber;
        this.kind = kind;
        this.payload = payload;
        this.prevHash = prevHash;
        this.hash = hash;
        this.recordedAt = recordedAt;
    }

    public Long getId() { return id; }
    public String getApplicationNumber() { return applicationNumber; }
    public Kind getKind() { return kind; }
    public String getPayload() { return payload; }
    public String getPrevHash() { return prevHash; }
    public String getHash() { return hash; }
    public Instant getRecordedAt() { return recordedAt; }
}
