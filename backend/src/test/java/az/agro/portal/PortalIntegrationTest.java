package az.agro.portal;

import az.agro.portal.ai.CropRecommendationService;
import az.agro.portal.ai.SoilClimate;
import az.agro.portal.repo.AppUserRepository;
import az.agro.portal.repo.CompetitionRepository;
import az.agro.portal.repo.LandPlotRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End-to-end tests against the seeded demo data (H2 in memory). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired LandPlotRepository plots;
    @Autowired CompetitionRepository competitions;
    @Autowired AppUserRepository users;
    @Autowired CropRecommendationService ai;
    @Autowired az.agro.portal.repo.ApplicationRepository applications;

    private static final byte[] PDF = "%PDF-1.4\ntest\n%%EOF".getBytes(StandardCharsets.US_ASCII);

    // ------------------------------------------------------------ access control

    @Test
    void protectedEndpointsRequireTheRightRole() throws Exception {
        mvc.perform(get("/api/v1/me/applications")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/dashboard")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/dashboard").with(user("investor@demo.az").roles("INVESTOR"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/dashboard").with(user("evaluator@demo.az").roles("EVALUATOR"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/audit").with(user("evaluator@demo.az").roles("EVALUATOR"))).andExpect(status().isForbidden());
    }

    @Test
    void systemEndpointsRequireApiKey() throws Exception {
        mvc.perform(get("/mock-ektis/api/v1/farmers/5ZK7QWE")).andExpect(status().isUnauthorized());
        mvc.perform(get("/mock-ektis/api/v1/farmers/5ZK7QWE").header("X-API-Key", "wrong")).andExpect(status().isUnauthorized());
        mvc.perform(get("/mock-ektis/api/v1/farmers/5ZK7QWE").header("X-API-Key", "demo-ektis-outbound-key"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fullName").value("Rəşad Məmmədov"));
        mvc.perform(post("/api/v1/integration/ektis/events").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginIsBlockedAfterFiveFailures() throws Exception {
        String bad = "{\"email\":\"aqro@demo.az\",\"password\":\"wrong-pass-1\"}";
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(bad)).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(bad)).andExpect(status().isTooManyRequests());
    }

    // ------------------------------------------------------------ competitions: four-eyes rule

    @Test
    void competitionNeedsApprovalFromAnotherAdmin() throws Exception {
        long plotId = plots.findAll().get(0).getId();
        String body = json.writeValueAsString(Map.of("title", "Test müsabiqəsi", "deadline", LocalDate.now().plusDays(20).toString(),
                "plotIds", new long[]{plotId}));
        JsonNode created = json.readTree(mvc.perform(post("/api/v1/admin/competitions").with(user("admin@demo.az").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        long id = created.get("id").asLong();

        mvc.perform(post("/api/v1/admin/competitions/" + id + "/submit").with(user("admin@demo.az").roles("ADMIN"))).andExpect(status().isOk());
        // the author cannot approve their own competition
        mvc.perform(post("/api/v1/admin/competitions/" + id + "/approve").with(user("admin@demo.az").roles("ADMIN"))).andExpect(status().isForbidden());
        // an evaluator cannot approve at all
        mvc.perform(post("/api/v1/admin/competitions/" + id + "/approve").with(user("evaluator@demo.az").roles("EVALUATOR"))).andExpect(status().isForbidden());
        assertThat(competitions.findById(id).orElseThrow().getStatus().name()).isEqualTo("PENDING_APPROVAL");
    }

    // ------------------------------------------------------------ applications

    private MockMultipartFile data(long competitionId, long plotId) throws Exception {
        Map<String, Object> r = Map.ofEntries(
                Map.entry("competitionId", competitionId), Map.entry("plotId", plotId), Map.entry("applicantType", "INDIVIDUAL"),
                Map.entry("applicantName", "Rəşad Məmmədov"), Map.entry("taxId", "5ZK7QWE"), Map.entry("phone", "+994 55 333 33 33"),
                Map.entry("email", "investor@demo.az"), Map.entry("activityType", "CROP_FARMING"), Map.entry("plannedCrop", "maize"),
                Map.entry("plannedInvestment", 400000), Map.entry("ownFundsPercent", 30), Map.entry("jobsCreated", 10),
                Map.entry("projectMonths", 36), Map.entry("experienceYears", 6),
                Map.entry("businessPlan", "Qarğıdalı və yem bitkiləri, damcı suvarma sistemi, soyuducu anbar. Birinci il torpağın hazırlanması, ikinci il tam istehsal, yerli sakinlər işlə təmin olunacaq."));
        return new MockMultipartFile("data", "", MediaType.APPLICATION_JSON_VALUE, json.writeValueAsBytes(r));
    }

    private long[] openCompetitionAndPlot(String plotCode) {
        var plot = plots.findAll().stream().filter(p -> p.getCode().equals(plotCode)).findFirst().orElseThrow();
        var comp = competitions.findByPlotId(plot.getId()).stream().filter(c -> c.isOpen()).findFirst().orElseThrow();
        return new long[]{comp.getId(), plot.getId()};
    }

    @Test
    void applicationValidatesDocumentsAndRejectsDuplicates() throws Exception {
        long[] cp = openCompetitionAndPlot("QR-AGD-002");
        var investor = user("investor@demo.az").roles("INVESTOR");

        // a file whose content is not a PDF is refused even with a .pdf name
        mvc.perform(multipart("/api/v1/me/applications").file(data(cp[0], cp[1]))
                        .file(new MockMultipartFile("files", "plan.pdf", "application/pdf", "MZ not a pdf".getBytes()))
                        .file(new MockMultipartFile("files", "id.pdf", "application/pdf", PDF))
                        .param("types", "BUSINESS_PLAN", "ID_DOCUMENT").with(investor))
                .andExpect(status().isBadRequest());

        // a missing mandatory document is reported by name
        mvc.perform(multipart("/api/v1/me/applications").file(data(cp[0], cp[1]))
                        .file(new MockMultipartFile("files", "plan.pdf", "application/pdf", PDF))
                        .param("types", "BUSINESS_PLAN").with(investor))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Şəxsiyyət vəsiqəsi")));

        // a complete application is registered with a number and an automatic score
        mvc.perform(multipart("/api/v1/me/applications").file(data(cp[0], cp[1]))
                        .file(new MockMultipartFile("files", "plan.pdf", "application/pdf", PDF))
                        .file(new MockMultipartFile("files", "id.pdf", "application/pdf", PDF))
                        .param("types", "BUSINESS_PLAN", "ID_DOCUMENT").with(investor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applicationNumber").value(org.hamcrest.Matchers.startsWith("QIM-")))
                .andExpect(jsonPath("$.autoScore").value(org.hamcrest.Matchers.greaterThan(50)));

        // the same applicant cannot apply twice for the same plot
        mvc.perform(multipart("/api/v1/me/applications").file(data(cp[0], cp[1]))
                        .file(new MockMultipartFile("files", "plan.pdf", "application/pdf", PDF))
                        .file(new MockMultipartFile("files", "id.pdf", "application/pdf", PDF))
                        .param("types", "BUSINESS_PLAN", "ID_DOCUMENT").with(investor))
                .andExpect(status().isConflict());

        // evaluators cannot jump straight to a decision
        var mine = json.readTree(mvc.perform(get("/api/v1/me/applications").with(investor)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        long appId = mine.get(0).get("id").asLong();
        mvc.perform(post("/api/v1/admin/applications/" + appId + "/status").with(user("evaluator@demo.az").roles("EVALUATOR"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isConflict());
        // and other investors cannot see it
        mvc.perform(get("/api/v1/me/applications/" + appId).with(user("leyla@demo.az").roles("INVESTOR"))).andExpect(status().isNotFound());
    }

    @Test
    void adminListsMaskPersonalIdentifiers() throws Exception {
        String body = mvc.perform(get("/api/v1/admin/applications").with(user("evaluator@demo.az").roles("EVALUATOR")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("5ZK7QWE").contains("5Z***WE");
    }

    @Test
    void approvalNeedsTwoIndependentCommissionScores() throws Exception {
        long id = applications.findAll().stream()
                .filter(a -> a.getStatus().name().equals("UNDER_REVIEW") && a.getPlot().getCode().equals("QR-TRT-001"))
                .findFirst().orElseThrow().getId();
        String approve = "{\"status\":\"APPROVED\",\"comment\":\"Qalib\"}";
        String score = "{\"feasibility\":8,\"financing\":7,\"socialImpact\":8,\"technology\":7,\"noConflict\":true}";

        mvc.perform(post("/api/v1/admin/applications/" + id + "/status").with(user("evaluator@demo.az").roles("EVALUATOR"))
                .contentType(MediaType.APPLICATION_JSON).content(approve)).andExpect(status().isConflict());
        // a member who does not declare the absence of a conflict of interest cannot score
        mvc.perform(post("/api/v1/admin/applications/" + id + "/score").with(user("evaluator@demo.az").roles("EVALUATOR"))
                .contentType(MediaType.APPLICATION_JSON).content(score.replace("true", "false"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/admin/applications/" + id + "/score").with(user("evaluator@demo.az").roles("EVALUATOR"))
                .contentType(MediaType.APPLICATION_JSON).content(score)).andExpect(status().isOk())
                .andExpect(jsonPath("$.commission.average").value(75));
        mvc.perform(post("/api/v1/admin/applications/" + id + "/score").with(user("admin@demo.az").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(score)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/admin/applications/" + id + "/status").with(user("evaluator@demo.az").roles("EVALUATOR"))
                .contentType(MediaType.APPLICATION_JSON).content(approve)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status.code").value("APPROVED"));
    }

    // ------------------------------------------------------------ AI

    @Test
    void aiRecommendsRegionalCropsAndFiltersTropicalOnes() {
        var cotton = ai.recommend(new SoilClimate(118, 46, 20, 24.2, 79, 6.9, 79));
        assertThat(cotton.recommendations()).isNotEmpty();
        assertThat(cotton.recommendations()).allMatch(c -> c.regionSuitable());
        if (cotton.modelLoaded()) {
            assertThat(cotton.best().code()).isEqualTo("cotton");
            var apple = ai.recommend(new SoilClimate(21, 133, 200, 22.4, 92, 5.9, 112));
            assertThat(apple.best().code()).isEqualTo("apple");
        }
    }

    // ------------------------------------------------------------ myGov

    @Test
    void myGovLoginCreatesAccountAndRejectsForgedState() throws Exception {
        MockHttpSession session = new MockHttpSession();
        String start = mvc.perform(get("/api/v1/auth/mygov/start").session(session)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String url = json.readTree(start).get("url").asText();
        String state = url.replaceAll(".*state=([^&]+).*", "$1");

        String auth = mvc.perform(post("/mock-mygov/api/authorize").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"client_id\":\"aqrar-invest-portal\",\"fin\":\"3LM8K2D\",\"state\":\"" + state + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String code = json.readTree(auth).get("code").asText();

        mvc.perform(post("/api/v1/auth/mygov/callback").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\",\"state\":\"forged\"}"))
                .andExpect(status().isBadRequest());
        assertThat(users.findByTaxIdIgnoreCase("3LM8K2D")).isEmpty();
        // The state is single-use: a forged attempt does not consume it, the genuine one succeeds.
        // (the controller only removes it after a match)
        mvc.perform(post("/api/v1/auth/mygov/callback").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\",\"state\":\"" + state + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.created").value(true))
                .andExpect(jsonPath("$.user.fullName").value("Günay Quliyeva"));
        assertThat(users.findByTaxIdIgnoreCase("3LM8K2D")).isPresent();
    }
}
