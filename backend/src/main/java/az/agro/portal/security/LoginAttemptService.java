package az.agro.portal.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Brute-force protection: blocks an account for 10 minutes after 5 failed logins. */
@Service
public class LoginAttemptService {

    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(10);

    private record Attempts(int count, Instant first) {
    }

    private final Map<String, Attempts> failures = new ConcurrentHashMap<>();

    public boolean isBlocked(String email) {
        Attempts a = failures.get(key(email));
        if (a == null) return false;
        if (a.first().plus(WINDOW).isBefore(Instant.now())) {
            failures.remove(key(email));
            return false;
        }
        return a.count() >= MAX_FAILURES;
    }

    public void recordFailure(String email) {
        failures.merge(key(email), new Attempts(1, Instant.now()),
                (old, fresh) -> old.first().plus(WINDOW).isBefore(Instant.now()) ? fresh : new Attempts(old.count() + 1, old.first()));
    }

    public void recordSuccess(String email) {
        failures.remove(key(email));
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
