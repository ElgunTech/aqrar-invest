package az.agro.portal.integration.mygov;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

/** OAuth 2.0 authorization-code client. Endpoints and credentials come from configuration only. */
@Component
public class HttpMyGovClient implements MyGovClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };

    private final String authorizeEndpoint;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final RestClient http;

    public HttpMyGovClient(@Value("${app.mygov.authorize-url}") String authorizeEndpoint,
                           @Value("${app.mygov.api-base-url}") String apiBaseUrl,
                           @Value("${app.mygov.client-id}") String clientId,
                           @Value("${app.mygov.client-secret}") String clientSecret,
                           @Value("${app.mygov.redirect-uri}") String redirectUri) {
        this.authorizeEndpoint = authorizeEndpoint;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        SimpleClientHttpRequestFactory timeouts = new SimpleClientHttpRequestFactory();
        timeouts.setConnectTimeout(3000);
        timeouts.setReadTimeout(5000);
        this.http = RestClient.builder().baseUrl(apiBaseUrl).requestFactory(timeouts).build();
    }

    @Override
    public String authorizeUrl(String state) {
        return UriComponentsBuilder.fromUriString(authorizeEndpoint)
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("scope", "openid profile fin phone")
                .queryParam("state", state)
                .build().encode().toUriString();
    }

    @Override
    public Identity exchange(String code) {
        Map<String, Object> token = http.post().uri("/token").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("grant_type", "authorization_code", "code", code, "client_id", clientId,
                        "client_secret", clientSecret, "redirect_uri", redirectUri))
                .retrieve().body(MAP);
        String accessToken = token == null ? null : String.valueOf(token.get("access_token"));
        Map<String, Object> info = http.get().uri("/userinfo").header("Authorization", "Bearer " + accessToken)
                .retrieve().body(MAP);
        if (info == null) throw new IllegalStateException("Empty userinfo");
        return new Identity(str(info.get("fin")), str(info.get("name")), str(info.get("phone")), str(info.get("email")));
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
