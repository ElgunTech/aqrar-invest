package az.agro.portal.service;

import az.agro.portal.domain.AuditLog;
import az.agro.portal.repo.AuditLogRepository;
import az.agro.portal.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class AuditService {

    private final AuditLogRepository repo;
    private final CurrentUser currentUser;

    public AuditService(AuditLogRepository repo, CurrentUser currentUser) {
        this.repo = repo;
        this.currentUser = currentUser;
    }

    public void log(String action, String entityType, Object entityId, String details) {
        logAs(currentUser.nameOrSystem(), action, entityType, entityId, details);
    }

    public void logAs(String actor, String action, String entityType, Object entityId, String details) {
        repo.save(new AuditLog(actor, action, entityType, entityId == null ? null : String.valueOf(entityId),
                truncate(details), clientIp()));
    }

    private static String clientIp() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return null;
        }
        HttpServletRequest req = attrs.getRequest();
        return req.getRemoteAddr();
    }

    private static String truncate(String s) {
        return s == null || s.length() <= 1000 ? s : s.substring(0, 997) + "...";
    }
}
