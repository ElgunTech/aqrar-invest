package az.agro.portal.integration;

import az.agro.portal.security.ApiKeyFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;

@Component
public class HttpEktisClient implements EktisClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };

    private final RestClient http;

    public HttpEktisClient(@Value("${app.ektis.base-url}") String baseUrl, @Value("${app.ektis.api-key}") String apiKey) {
        SimpleClientHttpRequestFactory timeouts = new SimpleClientHttpRequestFactory();
        timeouts.setConnectTimeout(3000);
        timeouts.setReadTimeout(5000);
        this.http = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(timeouts)
                .defaultHeader(ApiKeyFilter.HEADER, apiKey)
                .defaultHeader("X-Source-System", "AQRAR-INVEST-PORTAL")
                .build();
    }

    @Override
    public String submitApplication(Map<String, Object> payload) {
        Map<String, Object> res = http.post().uri("/applications").contentType(MediaType.APPLICATION_JSON)
                .body(payload).retrieve().body(MAP);
        return res == null ? null : String.valueOf(res.get("reference"));
    }

    @Override
    public void sendStatusUpdate(String ektisReference, Map<String, Object> payload) {
        http.post().uri("/applications/{ref}/status", ektisReference).contentType(MediaType.APPLICATION_JSON)
                .body(payload).retrieve().toBodilessEntity();
    }

    @Override
    public String publishCompetition(Map<String, Object> payload) {
        Map<String, Object> res = http.post().uri("/competitions").contentType(MediaType.APPLICATION_JSON)
                .body(payload).retrieve().body(MAP);
        return res == null ? null : String.valueOf(res.get("reference"));
    }

    @Override
    public Optional<Map<String, Object>> findFarmer(String taxId) {
        try {
            return Optional.ofNullable(http.get().uri("/farmers/{taxId}", taxId).retrieve().body(MAP));
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) return Optional.empty();
            throw e;
        }
    }
}
