package az.agro.portal.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * System-to-system authentication with the X-API-Key header:
 * <ul>
 *   <li>/api/v1/integration/** — calls from EKTİS into the portal (inbound key)</li>
 *   <li>/mock-ektis/** — the simulated EKTİS, called by the portal (outbound key)</li>
 * </ul>
 */
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-API-Key";

    private final String inboundKey;
    private final String outboundKey;

    public ApiKeyFilter(@Value("${app.integration.inbound-api-key}") String inboundKey,
                        @Value("${app.ektis.api-key}") String outboundKey) {
        this.inboundKey = inboundKey;
        this.outboundKey = outboundKey;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !(path.startsWith("/api/v1/integration/") || path.startsWith("/mock-ektis/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String expected = request.getRequestURI().startsWith("/mock-ektis/") ? outboundKey : inboundKey;
        String provided = request.getHeader(HEADER);
        boolean valid = provided != null
                && MessageDigest.isEqual(provided.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8));
        if (!valid) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":401,\"message\":\"Etibarsız və ya çatışmayan X-API-Key\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
