package az.agro.portal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Sign-in attempts from one client are capped per minute, independent of the per-account lockout. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RateLimitTest {

    @Autowired MockMvc mvc;

    @Test
    void loginIsLimitedPerClient() throws Exception {
        int last = 0;
        for (int i = 0; i < 11; i++) {
            last = mvc.perform(post("/api/v1/auth/login").with(csrf()).header("X-Forwarded-For", "203.0.113.77")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"nobody" + i + "@example.az\",\"password\":\"wrong-password\"}"))
                    .andReturn().getResponse().getStatus();
        }
        assertThat(last).isEqualTo(429);
        // another client is unaffected
        int other = mvc.perform(post("/api/v1/auth/login").with(csrf()).header("X-Forwarded-For", "203.0.113.78")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"x@example.az\",\"password\":\"wrong-password\"}"))
                .andReturn().getResponse().getStatus();
        assertThat(other).isNotEqualTo(429);
    }
}
