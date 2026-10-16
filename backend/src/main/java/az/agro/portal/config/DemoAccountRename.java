package az.agro.portal.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Renames demo accounts that an existing database was seeded with, so a live database follows the seeder's current
 * e-mails without being reset. Idempotent: does nothing once the old addresses are gone.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class DemoAccountRename implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountRename.class);
    static final Map<String, String> RENAMED = Map.of(
            "investor@demo.az", DemoDataSeeder.INVESTOR_EMAIL,
            "evaluator@demo.az", DemoDataSeeder.EVALUATOR_EMAIL);

    private final JdbcTemplate jdbc;

    public DemoAccountRename(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        RENAMED.forEach((from, to) -> {
            try {
                int users = jdbc.update("UPDATE app_user SET email = ? WHERE lower(email) = ? AND NOT EXISTS (SELECT 1 FROM app_user WHERE lower(email) = ?)", to, from, to);
                if (users > 0) {
                    jdbc.update("UPDATE investment_application SET email = ? WHERE lower(email) = ?", to, from);
                    log.info("Demo account {} renamed to {}", from, to);
                }
            } catch (Exception e) {
                log.debug("Demo account rename skipped: {}", e.getMessage());
            }
        });
    }
}
