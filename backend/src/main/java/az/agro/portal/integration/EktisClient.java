package az.agro.portal.integration;

import java.util.Map;
import java.util.Optional;

/**
 * Port to the Ministry of Agriculture's EKTİS. The portal depends only on this interface;
 * {@link HttpEktisClient} talks HTTP/JSON to whatever base URL is configured (today the built-in mock,
 * tomorrow the real EKTİS gateway) — switching is a configuration change, not a code change.
 */
public interface EktisClient {

    /** Registers a submitted application in EKTİS. Returns EKTİS's reference number. */
    String submitApplication(Map<String, Object> payload);

    /** Informs EKTİS about a status change of an application already registered there. */
    void sendStatusUpdate(String ektisReference, Map<String, Object> payload);

    /** Publishes a competition (and its plots) to EKTİS. Returns EKTİS's reference. */
    String publishCompetition(Map<String, Object> payload);

    /** Looks up a farmer in the EKTİS farmer registry by FİN / VÖEN. */
    Optional<Map<String, Object>> findFarmer(String taxId);
}
