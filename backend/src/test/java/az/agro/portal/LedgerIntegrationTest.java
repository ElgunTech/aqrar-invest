package az.agro.portal;

import az.agro.portal.domain.ApplicationStatus;
import az.agro.portal.repo.ApplicationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The decision ledger detects a direct database edit and stops flagging it once the record is restored. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LedgerIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ApplicationRepository applications;

    private JsonNode check(String number) throws Exception {
        return json.readTree(mvc.perform(get("/api/v1/public/verify/" + number + "/ledger")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void tamperingIsDetectedAndRestorable() throws Exception {
        String number = applications.findAll().stream().filter(a -> a.getStatus() == ApplicationStatus.APPROVED)
                .findFirst().orElseThrow().getApplicationNumber();

        JsonNode clean = check(number);
        assertThat(clean.path("chainValid").asBoolean()).isTrue();
        assertThat(clean.path("recordsValid").asBoolean()).isTrue();
        assertThat(clean.path("entries").size()).isGreaterThanOrEqualTo(4);

        mvc.perform(post("/api/v1/admin/ledger/tamper/" + number).with(csrf()).with(user("admin@demo.az").roles("ADMIN"))).andExpect(status().isOk());
        JsonNode tampered = check(number);
        assertThat(tampered.path("chainValid").asBoolean()).isTrue();
        assertThat(tampered.path("recordsValid").asBoolean()).isFalse();
        assertThat(tampered.path("issues").toString()).contains("status tarixçəsi");

        mvc.perform(post("/api/v1/admin/ledger/tamper/" + number).with(csrf()).with(user("admin@demo.az").roles("ADMIN"))).andExpect(status().isOk());
        assertThat(check(number).path("recordsValid").asBoolean()).isTrue();
    }

    @Test
    void investorCannotTamper() throws Exception {
        String number = applications.findAll().get(0).getApplicationNumber();
        mvc.perform(post("/api/v1/admin/ledger/tamper/" + number).with(csrf()).with(user("investor@demo.az").roles("INVESTOR"))).andExpect(status().isForbidden());
    }
}
