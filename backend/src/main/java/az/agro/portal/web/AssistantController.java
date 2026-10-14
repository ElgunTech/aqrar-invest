package az.agro.portal.web;

import az.agro.portal.service.AssistantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/public/assistant")
@Tag(name = "Köməkçi (chatbot)", description = "Portal, rəsmi statistika və ANAMA məlumatlarına əsaslanan köməkçi")
public class AssistantController {

    private final AssistantService assistant;

    public AssistantController(AssistantService assistant) {
        this.assistant = assistant;
    }

    @Operation(summary = "Suala cavab (mənbələr və keçidlərlə)")
    @PostMapping
    public AssistantService.Reply ask(@RequestBody Map<String, String> body) {
        String q = body.getOrDefault("message", "");
        if (q.isBlank() || q.length() > 500) throw ApiException.badRequest("Sual 1–500 simvol olmalıdır");
        return assistant.ask(q);
    }

    @Operation(summary = "Köməkçinin rejimi")
    @GetMapping("/info")
    public Map<String, Object> info() {
        return Map.of("llm", assistant.llmEnabled());
    }
}
