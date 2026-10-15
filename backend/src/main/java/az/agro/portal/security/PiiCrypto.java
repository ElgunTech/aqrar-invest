package az.agro.portal.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Field-level encryption of personal data (FİN/VÖEN, phone, address) with AES-256-GCM.
 * Stored form: {@code enc:v1:<base64(iv | ciphertext+tag)>}. Values without the prefix are legacy plaintext and are
 * read as they are (the startup migration encrypts them). Equality lookups use a keyed HMAC "blind index" instead of
 * the ciphertext, so the database never needs the key.
 * <p>
 * The key comes from {@code PII_KEY} (base64, 32 bytes). Without it a fixed development key is derived and a warning
 * is logged: fine for a local demo, never for production.
 */
public final class PiiCrypto {

    private static final Logger log = LoggerFactory.getLogger(PiiCrypto.class);
    public static final String PREFIX = "enc:v1:";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final byte[] KEY;
    private static final byte[] INDEX_KEY;

    static {
        String env = System.getenv("PII_KEY");
        byte[] k;
        if (env != null && !env.isBlank()) {
            k = Base64.getDecoder().decode(env.trim());
            if (k.length != 32) throw new IllegalStateException("PII_KEY must be 32 bytes (base64)");
        } else {
            k = sha256("aqrar-invest-development-pii-key".getBytes(StandardCharsets.UTF_8));
            log.warn("PII_KEY is not set: personal data is encrypted with the built-in development key");
        }
        KEY = k;
        INDEX_KEY = sha256(concat(k, "blind-index".getBytes(StandardCharsets.UTF_8)));
    }

    private PiiCrypto() {
    }

    public static boolean isEncrypted(String v) {
        return v != null && v.startsWith(PREFIX);
    }

    public static String encrypt(String plain) {
        if (plain == null || isEncrypted(plain)) return plain;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(KEY, "AES"), new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(concat(iv, ct));
        } catch (Exception e) {
            throw new IllegalStateException("PII encryption failed", e);
        }
    }

    public static String decrypt(String stored) {
        if (!isEncrypted(stored)) return stored;
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(KEY, "AES"), new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("PII decryption failed (wrong PII_KEY?)", e);
        }
    }

    /** Deterministic keyed hash for equality search on an encrypted field; case and spaces are normalised. */
    public static String index(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(INDEX_KEY, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.trim().toUpperCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] sha256(byte[] b) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(b);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] r = new byte[a.length + b.length];
        System.arraycopy(a, 0, r, 0, a.length);
        System.arraycopy(b, 0, r, a.length, b.length);
        return r;
    }
}
