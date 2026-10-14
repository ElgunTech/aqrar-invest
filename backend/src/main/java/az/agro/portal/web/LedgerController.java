package az.agro.portal.web;

import az.agro.portal.domain.InvestmentApplication;
import az.agro.portal.domain.StatusChange;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.service.AuditService;
import az.agro.portal.service.LedgerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@Tag(name = "Qərar jurnalı", description = "Dəyişdirilə bilməyən (hash zənciri) qərar jurnalı və onun yoxlanması")
public class LedgerController {

    private static final String MARK = " [bazada birbaşa dəyişdirilib]";

    private final LedgerService ledger;
    private final ApplicationRepository applications;
    private final AuditService audit;
    private final boolean demo;

    public LedgerController(LedgerService ledger, ApplicationRepository applications, AuditService audit,
                            @Value("${app.seed-demo-data:false}") boolean demo) {
        this.ledger = ledger;
        this.applications = applications;
        this.audit = audit;
        this.demo = demo;
    }

    @Operation(summary = "Müraciətin qərarlarının bütövlüyü: hash zənciri və möhürlənmiş qeydlərlə müqayisə")
    @GetMapping("/api/v1/public/verify/{number}/ledger")
    public LedgerService.Verification verify(@PathVariable String number) {
        return ledger.verify(number);
    }

    /**
     * Demonstration only (demo data mode): edits the latest status comment directly, the way a dishonest database
     * administrator would, without going through the ledger. A second call restores it.
     */
    @Operation(summary = "Demo: saxtakarlığı simulyasiya et / bərpa et")
    @PostMapping("/api/v1/admin/ledger/tamper/{number}")
    @Transactional
    public Map<String, Object> tamper(@PathVariable String number) {
        if (!demo) throw ApiException.forbidden("Yalnız demo rejimində mümkündür");
        InvestmentApplication a = applications.findByApplicationNumber(number).orElseThrow(() -> ApiException.notFound("Müraciət"));
        if (a.getHistory().isEmpty()) throw ApiException.conflict("Tarixçə boşdur");
        StatusChange last = a.getHistory().get(a.getHistory().size() - 1);
        String c = last.getComment() == null ? "" : last.getComment();
        boolean tampered = !c.endsWith(MARK);
        last.setComment(tampered ? c + MARK : c.substring(0, c.length() - MARK.length()));
        if (last.getComment() != null && last.getComment().isEmpty()) last.setComment(null);
        audit.log(tampered ? "LEDGER_TAMPER_DEMO" : "LEDGER_RESTORE_DEMO", "InvestmentApplication", a.getId(), number);
        return Map.of("tampered", tampered);
    }
}
