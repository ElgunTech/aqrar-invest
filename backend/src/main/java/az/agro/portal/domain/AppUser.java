package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 150)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Convert(converter = az.agro.portal.security.PiiConverter.class)
    @Column(length = 200)
    private String phone;

    /** FİN (individuals) or VÖEN (companies). Personal data: masked in lists. */
    @Convert(converter = az.agro.portal.security.PiiConverter.class)
    @Column(length = 200)
    private String taxId;

    /** Keyed hash of the FİN/VÖEN for lookups: the encrypted column itself cannot be searched. */
    @Column(length = 64)
    private String taxIdIndex;

    private boolean enabled = true;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected AppUser() {
    }

    public AppUser(String email, String passwordHash, String fullName, Role role) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.role = role;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public Role getRole() { return role; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getTaxId() { return taxId; }
    public void setTaxId(String taxId) {
        this.taxId = taxId;
        this.taxIdIndex = az.agro.portal.security.PiiCrypto.index(taxId);
    }
    public boolean isEnabled() { return enabled; }
    public Instant getCreatedAt() { return createdAt; }
}
