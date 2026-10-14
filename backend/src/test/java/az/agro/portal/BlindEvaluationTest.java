package az.agro.portal;

import az.agro.portal.domain.InvestmentApplication;
import az.agro.portal.repo.AppUserRepository;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.EvaluatorScoreRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A commission member sees an undecided application without the applicant's identity until they have scored it. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BlindEvaluationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ApplicationRepository applications;
    @Autowired AppUserRepository users;
    @Autowired EvaluatorScoreRepository scores;

    private JsonNode get(Long id) throws Exception {
        return json.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/admin/applications/" + id)
                        .with(user("admin@demo.az").roles("ADMIN"))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    @Test
    void identityOpensOnlyAfterOwnScore() throws Exception {
        Long admin = users.findByEmailIgnoreCase("admin@demo.az").orElseThrow().getId();
        InvestmentApplication a = applications.findAll().stream()
                .filter(x -> !x.getStatus().isFinal())
                .filter(x -> scores.findByApplicationIdAndEvaluatorId(x.getId(), admin).isEmpty())
                .findFirst().orElseThrow();

        JsonNode before = get(a.getId());
        assertThat(before.path("blind").asBoolean()).isTrue();
        assertThat(before.path("applicantName").asText()).startsWith("Müraciətçi A-").isNotEqualTo(a.getApplicantName());
        assertThat(before.path("email").isNull()).isTrue();

        mvc.perform(post("/api/v1/admin/applications/" + a.getId() + "/score").with(csrf()).with(user("admin@demo.az").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"feasibility\":7,\"financing\":7,\"socialImpact\":7,\"technology\":7,\"comment\":\"test\",\"noConflict\":true}"))
                .andExpect(status().isOk());

        JsonNode after = get(a.getId());
        assertThat(after.path("blind").asBoolean()).isFalse();
        assertThat(after.path("applicantName").asText()).isEqualTo(a.getApplicantName());
    }
}
