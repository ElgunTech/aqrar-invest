package az.agro.portal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The OCDS release package has the required fields and never names natural persons. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OcdsTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Test
    void releasePackage() throws Exception {
        String body = mvc.perform(get("/api/v1/public/open-data/ocds")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode pkg = json.readTree(body);
        assertThat(pkg.path("version").asText()).isEqualTo("1.1");
        assertThat(pkg.path("releases").size()).isGreaterThan(0);
        for (JsonNode r : pkg.path("releases")) {
            assertThat(r.path("ocid").asText()).startsWith("ocds-aqrar-");
            assertThat(r.path("tag").size()).isGreaterThan(0);
            assertThat(r.path("tender").path("items").size()).isGreaterThan(0);
        }
        assertThat(body).contains("\"awards\"");
        // seeded natural persons must not appear by name
        assertThat(body).doesNotContain("Leyla Hüseynova").doesNotContain("Elçin Qurbanov");
    }
}
