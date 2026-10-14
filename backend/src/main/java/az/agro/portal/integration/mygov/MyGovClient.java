package az.agro.portal.integration.mygov;

/**
 * Port to the national e-government identity provider (myGov). The portal only depends on this interface:
 * today it talks to the built-in simulator, in production to the real OAuth 2.0 / OpenID Connect endpoints.
 */
public interface MyGovClient {

    /** Citizen identity returned after a successful login. */
    record Identity(String fin, String fullName, String phone, String email) {
    }

    /** URL of the provider's consent screen the browser is sent to. */
    String authorizeUrl(String state);

    /** Exchanges the one-time authorization code for the citizen's identity. */
    Identity exchange(String code);
}
