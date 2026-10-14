package az.agro.portal.service;

import az.agro.portal.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Stores uploaded documents outside the web root under random names.
 * Files are accepted only if both the extension and the file signature ("magic bytes") match.
 * Each file is also copied into the database and restored from there when the disk copy is gone (ephemeral disks).
 */
@Service
public class FileStorageService {

    public static final long MAX_BYTES = 5L * 1024 * 1024;

    private static final Map<String, byte[]> SIGNATURES = Map.of(
            "pdf", new byte[]{'%', 'P', 'D', 'F'},
            "png", new byte[]{(byte) 0x89, 'P', 'N', 'G'},
            "jpg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "docx", new byte[]{'P', 'K', 3, 4});

    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "pdf", "application/pdf",
            "png", "image/png",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    public record StoredFile(String storedName, String originalName, String contentType, long size) {
    }

    private final Path root;
    private final az.agro.portal.repo.StoredBlobRepository blobs;

    public FileStorageService(@Value("${app.upload-dir}") String uploadDir, az.agro.portal.repo.StoredBlobRepository blobs) throws IOException {
        this.blobs = blobs;
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public StoredFile store(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Boş fayl göndərilib");
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("Fayl 5 MB-dan böyük ola bilməz");
        String original = sanitize(file.getOriginalFilename());
        String ext = extension(original);
        byte[] signature = SIGNATURES.get(ext);
        if (signature == null) throw ApiException.badRequest("İcazə verilən formatlar: PDF, JPG, PNG, DOCX");
        try (InputStream in = file.getInputStream()) {
            byte[] head = in.readNBytes(signature.length);
            if (!Arrays.equals(head, signature)) {
                throw ApiException.badRequest("Faylın məzmunu ." + ext + " formatına uyğun deyil");
            }
        } catch (IOException e) {
            throw ApiException.badRequest("Fayl oxuna bilmədi");
        }
        String stored = UUID.randomUUID() + "." + ext;
        try {
            byte[] content = file.getBytes();
            Files.write(root.resolve(stored), content);
            blobs.save(new az.agro.portal.domain.StoredBlob(stored, content));
        } catch (IOException e) {
            throw new IllegalStateException("Could not store file", e);
        }
        return new StoredFile(stored, original, CONTENT_TYPES.get(ext), file.getSize());
    }

    /** Used by the demo-data seeder. */
    public StoredFile storeBytes(String originalName, byte[] content) {
        String ext = extension(originalName);
        String stored = UUID.randomUUID() + "." + ext;
        try {
            Files.write(root.resolve(stored), content);
            blobs.save(new az.agro.portal.domain.StoredBlob(stored, content));
        } catch (IOException e) {
            throw new IllegalStateException("Could not store file", e);
        }
        return new StoredFile(stored, originalName, CONTENT_TYPES.getOrDefault(ext, "application/octet-stream"), content.length);
    }

    public Resource load(String storedName) {
        Path p = root.resolve(storedName).normalize();
        if (!p.startsWith(root)) throw ApiException.notFound("Fayl");
        if (!Files.exists(p)) {
            var blob = blobs.findById(storedName).orElseThrow(() -> ApiException.notFound("Fayl"));
            try {
                Files.write(p, blob.getContent());
            } catch (IOException e) {
                throw new IllegalStateException("Could not restore file", e);
            }
        }
        return new FileSystemResource(p);
    }

    private static String sanitize(String name) {
        if (name == null || name.isBlank()) return "fayl";
        String base = Path.of(name.replace('\\', '/')).getFileName().toString();
        base = base.replaceAll("[\\r\\n\"<>|:*?]", "_");
        return base.length() > 150 ? base.substring(base.length() - 150) : base;
    }

    private static String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
