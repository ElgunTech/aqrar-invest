package az.agro.portal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class PortalApplication {

    public static void main(String[] args) {
        useDatabaseUrl(System.getenv("DATABASE_URL"));
        randomSecretsUnlessSet();
        SpringApplication.run(PortalApplication.class, args);
    }

    /**
     * Hosted PostgreSQL (Neon, Render, Heroku-style) hands out one URL: postgresql://user:password@host/db?sslmode=require.
     * Turn it into the JDBC URL, user and password Spring expects, and switch to the postgres profile.
     */
    /**
     * The integration secrets have demo defaults for the tests; a running server never uses those public values.
     * Without the environment variable it gets a random secret for this boot (the built-in mocks read the same property).
     */
    static void randomSecretsUnlessSet() {
        String[][] secrets = {{"EKTIS_API_KEY", "app.ektis.api-key"}, {"INTEGRATION_API_KEY", "app.integration.inbound-api-key"},
                {"MYGOV_CLIENT_SECRET", "app.mygov.client-secret"}};
        java.security.SecureRandom random = new java.security.SecureRandom();
        for (String[] s : secrets) {
            String env = System.getenv(s[0]);
            if ((env == null || env.isBlank()) && System.getProperty(s[1]) == null) {
                byte[] b = new byte[24];
                random.nextBytes(b);
                System.setProperty(s[1], java.util.HexFormat.of().formatHex(b));
            }
        }
    }

    static void useDatabaseUrl(String url) {
        if (url == null || url.isBlank()) return;
        java.net.URI u = java.net.URI.create(url.trim());
        String[] userInfo = u.getRawUserInfo() == null ? new String[0] : u.getRawUserInfo().split(":", 2);
        String query = u.getRawQuery() == null ? "sslmode=require" : u.getRawQuery().replace("&channel_binding=require", "").replace("channel_binding=require&", "");
        System.setProperty("spring.datasource.url", "jdbc:postgresql://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "") + u.getRawPath() + "?" + query
                // Neon pools connections (PgBouncer): server-side prepared statements outlive schema changes and fail
                // with "cached plan must not change result type", so the driver must not prepare them.
                + (query.contains("prepareThreshold") ? "" : "&prepareThreshold=0"));
        if (userInfo.length > 0) System.setProperty("spring.datasource.username", java.net.URLDecoder.decode(userInfo[0], java.nio.charset.StandardCharsets.UTF_8));
        if (userInfo.length > 1) System.setProperty("spring.datasource.password", java.net.URLDecoder.decode(userInfo[1], java.nio.charset.StandardCharsets.UTF_8));
        System.setProperty("spring.jpa.database-platform", "org.hibernate.dialect.PostgreSQLDialect");
        System.setProperty("spring.datasource.hikari.maximum-pool-size", "5");
    }
}
