package az.agro.portal.web;

import az.agro.portal.service.AssistantService;
import az.agro.portal.service.MailService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Which optional channels are switched on in this deployment and the database engine (no secrets). */
@RestController
@Tag(name = "Status")
public class StatusController {

    private final MailService mail;
    private final AssistantService assistant;
    private final String database;

    public StatusController(MailService mail, AssistantService assistant, javax.sql.DataSource ds) {
        String db;
        try (var c = ds.getConnection()) {
            db = c.getMetaData().getDatabaseProductName();
        } catch (Exception e) {
            db = "unknown";
        }
        this.database = db;
        this.mail = mail;
        this.assistant = assistant;
    }

    @Operation(summary = "E-poçt və LLM kanallarının vəziyyəti")
    @GetMapping("/api/v1/public/status")
    public Map<String, Object> status() {
        return Map.of("email", mail.enabled(), "llm", assistant.llmEnabled(), "database", database);
    }
}
