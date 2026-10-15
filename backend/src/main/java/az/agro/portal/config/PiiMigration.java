package az.agro.portal.config;

import az.agro.portal.security.PiiCrypto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Brings an existing database up to field-level encryption: widens the personal-data columns (Hibernate's schema
 * update never changes a column length), encrypts rows still stored in plain text and fills the FİN blind index.
 * Idempotent and runs before the demo seeder. The same SQL works on PostgreSQL and H2.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PiiMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PiiMigration.class);
    private static final List<String[]> COLUMNS = List.of(
            new String[]{"app_user", "phone", "200"},
            new String[]{"app_user", "tax_id", "200"},
            new String[]{"investment_application", "tax_id", "200"},
            new String[]{"investment_application", "phone", "200"},
            new String[]{"investment_application", "address", "1200"});

    private final JdbcTemplate jdbc;

    public PiiMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String[] c : COLUMNS) {
            try {
                jdbc.execute("ALTER TABLE " + c[0] + " ALTER COLUMN " + c[1] + " SET DATA TYPE VARCHAR(" + c[2] + ")");
            } catch (Exception e) {
                log.debug("Column {}.{} not widened: {}", c[0], c[1], e.getMessage());
            }
        }
        int encrypted = 0;
        for (String[] c : COLUMNS) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, " + c[1] + " AS v FROM " + c[0] + " WHERE " + c[1] + " IS NOT NULL AND " + c[1] + " NOT LIKE 'enc:v1:%'");
            for (Map<String, Object> r : rows) {
                jdbc.update("UPDATE " + c[0] + " SET " + c[1] + " = ? WHERE id = ?", PiiCrypto.encrypt((String) r.get("v")), r.get("id"));
                encrypted++;
            }
        }
        int indexed = 0;
        for (Map<String, Object> r : jdbc.queryForList("SELECT id, tax_id FROM app_user WHERE tax_id IS NOT NULL AND tax_id_index IS NULL")) {
            jdbc.update("UPDATE app_user SET tax_id_index = ? WHERE id = ?", PiiCrypto.index(PiiCrypto.decrypt((String) r.get("tax_id"))), r.get("id"));
            indexed++;
        }
        if (encrypted + indexed > 0) log.info("PII migration: {} values encrypted, {} FİN index entries written", encrypted, indexed);
    }
}
