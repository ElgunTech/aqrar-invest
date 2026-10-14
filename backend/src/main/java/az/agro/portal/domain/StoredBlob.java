package az.agro.portal.domain;

import jakarta.persistence.*;

/** Database copy of an uploaded file, so documents survive a redeploy on hosts with an ephemeral disk. */
@Entity
@Table(name = "stored_blob")
public class StoredBlob {

    @Id
    @Column(length = 64)
    private String name;


    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] content;

    protected StoredBlob() {
    }

    public StoredBlob(String name, byte[] content) {
        this.name = name;
        this.content = content;
    }

    public String getName() { return name; }
    public byte[] getContent() { return content; }
}
