package az.agro.portal;

import az.agro.portal.repo.AppUserRepository;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.security.PiiCrypto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/** FİN, phone and address are encrypted in the database and readable through the application; FİN stays searchable. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
@ActiveProfiles("test")
class PiiEncryptionTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationRepository applications;
    @Autowired AppUserRepository users;

    @Test
    void personalDataIsEncryptedAtRest() {
        var raw = jdbc.queryForList("SELECT tax_id, phone, address FROM investment_application");
        assertThat(raw).isNotEmpty();
        assertThat(raw).allSatisfy(r -> {
            assertThat((String) r.get("tax_id")).startsWith(PiiCrypto.PREFIX);
            if (r.get("phone") != null) assertThat((String) r.get("phone")).startsWith(PiiCrypto.PREFIX);
        });
        var app = applications.findAll().get(0);
        assertThat(app.getTaxId()).doesNotStartWith(PiiCrypto.PREFIX).hasSizeBetween(7, 10);
    }

    @Test
    void finIsFoundThroughTheBlindIndex() {
        var u = users.findAll().stream().filter(x -> x.getTaxId() != null).findFirst().orElseThrow();
        String rawFin = jdbc.queryForObject("SELECT tax_id FROM app_user WHERE id = ?", String.class, u.getId());
        assertThat(rawFin).startsWith(PiiCrypto.PREFIX);
        assertThat(users.findByTaxIdIndex(PiiCrypto.index(u.getTaxId().toLowerCase()))).isPresent();
    }

    @Test
    void cipherIsRandomisedAndRoundTrips() {
        String a = PiiCrypto.encrypt("1ABC234"), b = PiiCrypto.encrypt("1ABC234");
        assertThat(a).isNotEqualTo(b);
        assertThat(PiiCrypto.decrypt(a)).isEqualTo("1ABC234");
        assertThat(PiiCrypto.decrypt("plain-legacy")).isEqualTo("plain-legacy");
    }
}
