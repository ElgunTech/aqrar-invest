package az.agro.portal.integration.mock;

import az.agro.portal.security.ApiKeyFilter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simulated EKTİS (Elektron Kənd Təsərrüfatı İnformasiya Sistemi). It is deliberately isolated:
 * the portal reaches it only over HTTP through {@code HttpEktisClient}, exactly as it would reach the real system.
 * It also calls the portal back (webhook) a few seconds after an application arrives — farmer registry check.
 */
@RestController
@RequestMapping("/mock-ektis/api/v1")
@Tag(name = "Mock EKTİS", description = "EKTİS simulyatoru (X-API-Key tələb olunur)")
public class MockEktisController {

    private static final Logger log = LoggerFactory.getLogger(MockEktisController.class);

    private final Deque<Map<String, Object>> inbox = new ConcurrentLinkedDeque<>();
    private final AtomicInteger sequence = new AtomicInteger(1000);
    private final AtomicBoolean outage = new AtomicBoolean(false);
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final RestClient callback;
    private final long callbackDelayMs;

    /** Simulated farmer registry. */
    private static final Map<String, Map<String, Object>> FARMERS = Map.of(
            "5ZK7QWE", farmer("5ZK7QWE", "Rəşad Məmmədov", "Ağcabədi", 42.5, 2011),
            "1402567891", farmer("1402567891", "\"Qarabağ Aqro\" MMC", "Bərdə", 310.0, 2015),
            "7AB3XYZ", farmer("7AB3XYZ", "Leyla Hüseynova", "Tərtər", 18.0, 2018),
            "1700456123", farmer("1700456123", "\"Şuşa Bağları\" MMC", "Şuşa", 75.0, 2022));

    public MockEktisController(@Value("${app.mock-ektis.callback-url}") String callbackUrl,
                               @Value("${app.integration.inbound-api-key}") String inboundKey,
                               @Value("${app.mock-ektis.callback-delay-ms}") long callbackDelayMs) {
        this.callback = RestClient.builder().baseUrl(callbackUrl).defaultHeader(ApiKeyFilter.HEADER, inboundKey).build();
        this.callbackDelayMs = callbackDelayMs;
    }

    private static Map<String, Object> farmer(String taxId, String name, String district, double landHa, int since) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("taxId", taxId);
        f.put("fullName", name);
        f.put("district", district);
        f.put("registeredLandHa", landHa);
        f.put("farmerSince", since);
        f.put("subsidyRecipient", true);
        return f;
    }

    public boolean isOutage() {
        return outage.get();
    }

    public void setOutage(boolean enabled) {
        outage.set(enabled);
        log.info("Mock EKTİS outage simulation: {}", enabled ? "ON" : "OFF");
    }

    public List<Map<String, Object>> inbox() {
        return new ArrayList<>(inbox);
    }

    @Operation(summary = "Müraciəti EKTİS-də qeydiyyata al")
    @PostMapping(value = "/applications", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> receiveApplication(@RequestBody Map<String, Object> body) {
        if (outage.get()) return unavailable();
        String ref = "EKTIS-APP-" + LocalDate.now().getYear() + "-" + sequence.incrementAndGet();
        record("APPLICATION", ref, body);

        String number = String.valueOf(body.get("applicationNumber"));
        Object applicant = body.get("applicant");
        String taxId = applicant instanceof Map<?, ?> m ? String.valueOf(m.get("taxId")) : "";
        scheduler.schedule(() -> sendRegistryCheck(number, ref, taxId), callbackDelayMs, TimeUnit.MILLISECONDS);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("reference", ref, "status", "RECEIVED", "receivedAt", Instant.now().toString()));
    }

    @Operation(summary = "Müraciətin statusunun yenilənməsi")
    @PostMapping("/applications/{reference}/status")
    public ResponseEntity<Map<String, Object>> statusUpdate(@PathVariable String reference, @RequestBody Map<String, Object> body) {
        if (outage.get()) return unavailable();
        record("STATUS_UPDATE", reference, body);
        return ResponseEntity.accepted().body(Map.of("reference", reference, "accepted", true));
    }

    @Operation(summary = "Müsabiqənin EKTİS-də dərci")
    @PostMapping("/competitions")
    public ResponseEntity<Map<String, Object>> competition(@RequestBody Map<String, Object> body) {
        if (outage.get()) return unavailable();
        String ref = "EKTIS-CMP-" + sequence.incrementAndGet();
        record("COMPETITION", ref, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("reference", ref));
    }

    @Operation(summary = "Fermer reyestrində axtarış (FİN / VÖEN)")
    @GetMapping("/farmers/{taxId}")
    public ResponseEntity<Map<String, Object>> farmer(@PathVariable String taxId) {
        if (outage.get()) return unavailable();
        Map<String, Object> f = FARMERS.get(taxId.toUpperCase(Locale.ROOT));
        return f == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(f);
    }

    private void sendRegistryCheck(String applicationNumber, String reference, String taxId) {
        boolean known = FARMERS.containsKey(taxId.toUpperCase(Locale.ROOT));
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", known ? "FARMER_VERIFIED" : "FARMER_REGISTERED");
        event.put("applicationNumber", applicationNumber);
        event.put("ektisReference", reference);
        event.put("message", known
                ? "Fermer reyestrində təsdiqləndi (" + FARMERS.get(taxId.toUpperCase(Locale.ROOT)).get("fullName") + ")"
                : "Fermer reyestrində ilkin qeydiyyat yaradıldı");
        event.put("data", Map.of("taxId", taxId, "checkedAt", Instant.now().toString()));
        try {
            callback.post().contentType(MediaType.APPLICATION_JSON).body(event).retrieve().toBodilessEntity();
        } catch (Exception e) {
            log.warn("Mock EKTİS callback failed for {}: {}", applicationNumber, e.getMessage());
        }
    }

    private void record(String type, String reference, Map<String, Object> body) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("type", type);
        entry.put("reference", reference);
        entry.put("receivedAt", Instant.now().toString());
        entry.put("body", body);
        inbox.addFirst(entry);
        while (inbox.size() > 100) inbox.removeLast();
    }

    private static ResponseEntity<Map<String, Object>> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", "EKTİS müvəqqəti əlçatan deyil (simulyasiya)"));
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
    }
}
