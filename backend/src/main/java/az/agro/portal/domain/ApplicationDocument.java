package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "application_document")
public class ApplicationDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private InvestmentApplication application;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, length = 30)
    private DocumentType type;

    @Column(nullable = false, length = 200)
    private String originalName;

    /** Random file name on disk — never derived from user input. */
    @Column(nullable = false, length = 80)
    private String storedName;

    @Column(length = 100)
    private String contentType;

    private long sizeBytes;

    private Instant uploadedAt = Instant.now();

    protected ApplicationDocument() {
    }

    public ApplicationDocument(DocumentType type, String originalName, String storedName, String contentType, long sizeBytes) {
        this.type = type;
        this.originalName = originalName;
        this.storedName = storedName;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
    }

    public Long getId() { return id; }
    public InvestmentApplication getApplication() { return application; }
    void setApplication(InvestmentApplication application) { this.application = application; }
    public DocumentType getType() { return type; }
    public String getOriginalName() { return originalName; }
    public String getStoredName() { return storedName; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public Instant getUploadedAt() { return uploadedAt; }
}
