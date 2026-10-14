package az.agro.portal.web;

import az.agro.portal.service.IntegrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Webhook EKTİS calls to push events into the portal. Authenticated with X-API-Key (see ApiKeyFilter). */
@RestController
@RequestMapping("/api/v1/integration/ektis")
@Tag(name = "EKTİS inteqrasiyası (daxil olan)", description = "EKTİS-dən portala hadisələr — X-API-Key tələb olunur")
public class IntegrationController {

    private final IntegrationService integration;

    public IntegrationController(IntegrationService integration) {
        this.integration = integration;
    }

    @Operation(summary = "EKTİS hadisəsini qəbul et (FARMER_VERIFIED, FARMER_REGISTERED, ...)")
    @PostMapping("/events")
    public Map<String, Object> receive(@RequestBody IntegrationService.InboundEvent event) {
        return integration.receive(event);
    }
}
