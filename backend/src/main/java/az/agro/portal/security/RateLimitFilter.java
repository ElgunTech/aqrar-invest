package az.agro.portal.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-client request limits (fixed one-minute windows). Tight on sign-in and registration (password guessing),
 * moderate on endpoints that call external services or the assistant, generous on the rest of the API.
 * The client is the first address in X-Forwarded-For when the request came through the Vercel proxy.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String name, int perMinute) {}
    private static final class Window {
        long minute;
        int count;
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final boolean enabled;

    public RateLimitFilter(@Value("${app.rate-limit.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    private static Rule rule(String path, String method) {
        if (path.startsWith("/api/v1/auth/login") || path.startsWith("/api/v1/auth/register")) return new Rule("auth", 10);
        if (path.startsWith("/api/v1/public/assistant") && "POST".equals(method)) return new Rule("assistant", 20);
        if (path.matches("/api/v1/public/plots/\\d+/(satellite|solar)")) return new Rule("geo", 40);
        if (path.startsWith("/api/")) return new Rule("api", 300);
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        Rule r = enabled ? rule(req.getRequestURI(), req.getMethod()) : null;
        if (r != null) {
            String key = r.name() + "|" + client(req);
            long minute = System.currentTimeMillis() / 60_000;
            Window w = windows.computeIfAbsent(key, k -> new Window());
            int count;
            synchronized (w) {
                if (w.minute != minute) {
                    w.minute = minute;
                    w.count = 0;
                }
                count = ++w.count;
            }
            res.setHeader("X-RateLimit-Limit", String.valueOf(r.perMinute()));
            res.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, r.perMinute() - count)));
            if (count > r.perMinute()) {
                res.setStatus(429);
                res.setHeader("Retry-After", String.valueOf(60 - (System.currentTimeMillis() / 1000) % 60));
                res.setContentType("application/json;charset=UTF-8");
                res.getOutputStream().write("{\"status\":429,\"message\":\"Çox sayda sorğu. Bir dəqiqədən sonra yenidən cəhd edin.\"}"
                        .getBytes(StandardCharsets.UTF_8));
                return;
            }
            if (windows.size() > 50_000) windows.entrySet().removeIf(e -> e.getValue().minute < minute);
        }
        chain.doFilter(req, res);
    }

    private static String client(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) return xf.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
