package az.agro.portal;

import az.agro.portal.repo.ApplicationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MonitoringIntegrityTest {

    /** multipart() with a CSRF token, keeping the multipart builder type so .file() can follow. */
    private static org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder multipartCsrf(String url) {
        var b = multipart(url);
        b.with(csrf());
        return b;
    }


    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ApplicationRepository applications;

    private JsonNode body(org.springframework.test.web.servlet.ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    @Test
    void integritySignalsFlagTheSuspiciousApplication() throws Exception {
        long id = applications.findAll().stream().filter(a -> a.getApplicantName().equals("Elçin Qurbanov")).findFirst().orElseThrow().getId();
        JsonNode app = body(mvc.perform(get("/api/v1/admin/applications/" + id).with(user("evaluator@demo.az").roles("EVALUATOR"))).andExpect(status().isOk()));
        List<String> codes = new ArrayList<>();
        app.get("integrity").forEach(s -> codes.add(s.get("code").asText()));
        assertThat(codes).contains("SHARED_PHONE", "COPIED_PLAN", "LOW_INVESTMENT", "CONFLICT_SURNAME");

        // applicants never see the signals
        long leyla = applications.findAll().stream().filter(a -> a.getApplicantName().equals("Leyla Hüseynova")
                && a.getPlot().getCode().equals("QR-FZL-002")).findFirst().orElseThrow().getId();
        JsonNode own = body(mvc.perform(get("/api/v1/me/applications/" + leyla).with(user("leyla@demo.az").roles("INVESTOR"))));
        assertThat(own.get("integrity")).isEmpty();
    }

    @Test
    void monitoringShowsOverdueObligationAndChecksPhotoLocation() throws Exception {
        JsonNode portfolio = body(mvc.perform(get("/api/v1/admin/monitoring").with(user("admin@demo.az").roles("ADMIN"))).andExpect(status().isOk()));
        JsonNode project = portfolio.get(0);
        assertThat(project.get("light").asText()).isEqualTo("red");
        JsonNode overdue = project.get("milestones").get(1);
        assertThat(overdue.get("light").asText()).isEqualTo("red");

        // the investor reports milestone 2 with a photo taken 50 km away: flagged as outside the plot
        long appId = project.get("applicationId").asLong();
        long mid = overdue.get("id").asLong();
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10};
        JsonNode after = body(mvc.perform(multipartCsrf("/api/v1/me/applications/" + appId + "/milestones/" + mid + "/report")
                        .file(new MockMultipartFile("photo", "sahe.png", "image/png", png))
                        .param("text", "Bağ salınıb").param("investment", "260000").param("lat", "40.40").param("lng", "49.86")
                        .with(user("aqro@demo.az").roles("INVESTOR")))
                .andExpect(status().isOk()));
        JsonNode m2 = after.get("milestones").get(1);
        assertThat(m2.get("status").asText()).isEqualTo("REPORTED");
        assertThat(m2.get("gpsInsidePlot").asBoolean()).isFalse();
    }
}
