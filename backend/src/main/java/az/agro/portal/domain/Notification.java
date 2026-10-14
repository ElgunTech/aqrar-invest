package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "notification")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private AppUser recipient;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 1000)
    private String message;

    @Column(length = 200)
    private String link;

    @Column(name = "is_read")
    private boolean read;

    private Instant createdAt = Instant.now();

    protected Notification() {
    }

    public Notification(AppUser recipient, String title, String message, String link) {
        this.recipient = recipient;
        this.title = title;
        this.message = message;
        this.link = link;
    }

    public Long getId() { return id; }
    public AppUser getRecipient() { return recipient; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public String getLink() { return link; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public Instant getCreatedAt() { return createdAt; }
}
