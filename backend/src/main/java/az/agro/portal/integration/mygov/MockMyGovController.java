package az.agro.portal.integration.mygov;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simulated myGov identity provider (OAuth 2.0 authorization code flow) for the demo.
 * It is clearly labelled as a simulation in the UI and carries no real branding.
 * Codes and tokens are random, single-use and expire after 2 minutes.
 */
@RestController
@RequestMapping("/mock-mygov/api")
@Tag(name = "Mock myGov", description = "myGov identifikasiya simulyatoru (OAuth 2.0)")
public class MockMyGovController {

    private record Grant(MyGovClient.Identity identity, Instant expires) {
    }

    /** Simulated civil registry. */
    static final List<MyGovClient.Identity> CITIZENS = List.of(
            new MyGovClient.Identity("5ZK7QWE", "Rəşad Məmmədov", "+994 55 333 33 33", "investor@demo.az"),
            new MyGovClient.Identity("7AB3XYZ", "Leyla Hüseynova", "+994 70 555 55 55", "leyla@demo.az"),
            new MyGovClient.Identity("6QW2E9R", "Kamran Həsənov", "+994 50 777 12 34", null),
            new MyGovClient.Identity("3LM8K2D", "Günay Quliyeva", "+994 51 222 98 76", null));

    private final Map<String, Grant> codes = new ConcurrentHashMap<>();
    private final Map<String, Grant> tokens = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final String clientId;
    private final String clientSecret;

    public MockMyGovController(@Value("${app.mygov.client-id}") String clientId,
                               @Value("${app.mygov.client-secret}") String clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    @Operation(summary = "Simulyasiya: demo vətəndaşların siyahısı (razılıq ekranı üçün)")
    @GetMapping("/citizens")
    public List<Map<String, String>> citizens() {
        return CITIZENS.stream().map(c -> Map.of("fin", c.fin(), "name", c.fullName(), "phone", mask(c.phone()))).toList();
    }

    @Operation(summary = "Vətəndaş razılıq verdi: birdəfəlik kod buraxılır")
    @PostMapping("/authorize")
    public ResponseEntity<Map<String, String>> authorize(@RequestBody Map<String, String> body) {
        if (!clientId.equals(body.get("client_id"))) return error(HttpStatus.BAD_REQUEST, "invalid_client");
        String fin = Optional.ofNullable(body.get("fin")).orElse("").trim().toUpperCase(Locale.ROOT);
        MyGovClient.Identity who = CITIZENS.stream().filter(c -> c.fin().equals(fin)).findFirst().orElse(null);
        if (who == null) return error(HttpStatus.NOT_FOUND, "Bu FİN ilə vətəndaş tapılmadı");
        String code = token();
        codes.put(code, new Grant(who, Instant.now().plusSeconds(120)));
        return ResponseEntity.ok(Map.of("code", code, "state", Optional.ofNullable(body.get("state")).orElse("")));
    }

    @Operation(summary = "Kodun access token-ə dəyişdirilməsi (portal serveri çağırır)")
    @PostMapping("/token")
    public ResponseEntity<Map<String, Object>> token(@RequestBody Map<String, String> body) {
        if (!clientId.equals(body.get("client_id")) || !constantTimeEquals(clientSecret, body.get("client_secret"))) {
            return error(HttpStatus.UNAUTHORIZED, "invalid_client");
        }
        Grant g = codes.remove(Optional.ofNullable(body.get("code")).orElse(""));
        if (g == null || g.expires().isBefore(Instant.now())) return error(HttpStatus.BAD_REQUEST, "invalid_grant");
        String access = token();
        tokens.put(access, new Grant(g.identity(), Instant.now().plusSeconds(120)));
        return ResponseEntity.ok(Map.of("access_token", access, "token_type", "Bearer", "expires_in", 120));
    }

    @Operation(summary = "Vətəndaşın identifikasiya məlumatları")
    @GetMapping("/userinfo")
    public ResponseEntity<Map<String, Object>> userinfo(@RequestHeader(value = "Authorization", required = false) String auth) {
        String t = auth != null && auth.startsWith("Bearer ") ? auth.substring(7) : "";
        Grant g = tokens.remove(t);
        if (g == null || g.expires().isBefore(Instant.now())) return error(HttpStatus.UNAUTHORIZED, "invalid_token");
        MyGovClient.Identity i = g.identity();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("fin", i.fin());
        m.put("name", i.fullName());
        m.put("phone", i.phone());
        m.put("email", i.email());
        return ResponseEntity.ok(m);
    }

    private String token() {
        byte[] b = new byte[24];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static boolean constantTimeEquals(String a, String b) {
        return b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String mask(String phone) {
        return phone == null || phone.length() < 6 ? "" : phone.substring(0, 7) + " *** ** " + phone.substring(phone.length() - 2);
    }

    @SuppressWarnings("unchecked")
    private static <T> ResponseEntity<T> error(HttpStatus status, String message) {
        return (ResponseEntity<T>) ResponseEntity.status(status).body(Map.of("message", message));
    }
}
