package az.agro.portal.web;

import az.agro.portal.domain.AppUser;
import az.agro.portal.domain.Role;
import az.agro.portal.dto.AuthDtos.*;
import az.agro.portal.integration.mygov.MyGovClient;
import az.agro.portal.repo.AppUserRepository;
import az.agro.portal.security.CurrentUser;
import az.agro.portal.security.LoginAttemptService;
import az.agro.portal.service.AuditService;
import az.agro.portal.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Autentifikasiya", description = "Qeydiyyat, daxilolma, çıxış")
public class AuthController {

    private final AuthenticationManager authManager;
    private final SecurityContextRepository contextRepository;
    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final CurrentUser currentUser;
    private final LoginAttemptService attempts;
    private final NotificationService notifications;
    private final AuditService audit;
    private final MyGovClient myGov;
    private final SecureRandom random = new SecureRandom();

    private static final String MYGOV_STATE = "MYGOV_STATE";

    public AuthController(AuthenticationManager authManager, SecurityContextRepository contextRepository, AppUserRepository users,
                          PasswordEncoder encoder, CurrentUser currentUser, LoginAttemptService attempts,
                          NotificationService notifications, AuditService audit, MyGovClient myGov) {
        this.myGov = myGov;
        this.authManager = authManager;
        this.contextRepository = contextRepository;
        this.users = users;
        this.encoder = encoder;
        this.currentUser = currentUser;
        this.attempts = attempts;
        this.notifications = notifications;
        this.audit = audit;
    }

    @Operation(summary = "Daxil ol (sessiya cookie-si qaytarılır)")
    @PostMapping("/login")
    public UserDto login(@Valid @RequestBody LoginRequest r, HttpServletRequest req, HttpServletResponse res) {
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        if (attempts.isBlocked(email)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Çox sayda uğursuz cəhd. 10 dəqiqə sonra yenidən yoxlayın.");
        }
        Authentication auth;
        try {
            auth = authManager.authenticate(new UsernamePasswordAuthenticationToken(email, r.password()));
        } catch (AuthenticationException e) {
            attempts.recordFailure(email);
            audit.logAs(email, "LOGIN_FAILED", "AppUser", null, null);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "E-poçt və ya şifrə yanlışdır");
        }
        attempts.recordSuccess(email);
        establishSession(auth, req, res);
        audit.logAs(email, "LOGIN", "AppUser", null, null);
        return toDto(users.findByEmailIgnoreCase(email).orElseThrow());
    }

    @Operation(summary = "Sahibkar kimi qeydiyyatdan keç")
    @PostMapping("/register")
    @Transactional
    public UserDto register(@Valid @RequestBody RegisterRequest r, HttpServletRequest req, HttpServletResponse res) {
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) throw ApiException.conflict("Bu e-poçt ilə hesab artıq mövcuddur");
        String fin = r.fin() == null || r.fin().isBlank() ? null : r.fin().trim().toUpperCase(Locale.ROOT);
        if (fin != null && users.findByTaxIdIgnoreCase(fin).isPresent()) {
            throw ApiException.conflict("Bu FİN ilə hesab artıq mövcuddur. myGov ilə daxil olun.");
        }
        AppUser u = new AppUser(email, encoder.encode(r.password()), r.fullName().trim(), Role.INVESTOR);
        u.setPhone(r.phone());
        u.setTaxId(fin);
        users.save(u);
        notifications.notify(u, "Portala xoş gəlmisiniz!", "Xəritədən sahələrə baxın, uyğunluq testindən keçin və müsabiqəyə müraciət edin.", "/xerite");
        Authentication auth = authManager.authenticate(new UsernamePasswordAuthenticationToken(email, r.password()));
        establishSession(auth, req, res);
        audit.logAs(email, "REGISTERED", "AppUser", u.getId(), null);
        return toDto(u);
    }

    @Operation(summary = "myGov ilə giriş: razılıq səhifəsinin ünvanı (OAuth 2.0, state sessiyada saxlanılır)")
    @GetMapping("/mygov/start")
    public Map<String, String> myGovStart(HttpServletRequest req) {
        byte[] b = new byte[18];
        random.nextBytes(b);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        req.getSession(true).setAttribute(MYGOV_STATE, state);
        return Map.of("url", myGov.authorizeUrl(state));
    }

    @Operation(summary = "myGov geri çağırışı: kod identifikasiyaya dəyişdirilir, hesab tapılır və ya yaradılır")
    @PostMapping("/mygov/callback")
    @Transactional
    public Map<String, Object> myGovCallback(@Valid @RequestBody MyGovCallback r, HttpServletRequest req, HttpServletResponse res) {
        HttpSession session = req.getSession(false);
        Object expected = session == null ? null : session.getAttribute(MYGOV_STATE);
        if (expected == null || !expected.equals(r.state())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Sessiya vaxtı bitib və ya sorğu etibarsızdır. Yenidən cəhd edin.");
        }
        session.removeAttribute(MYGOV_STATE);
        MyGovClient.Identity id;
        try {
            id = myGov.exchange(r.code());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "myGov cavab vermədi və ya kod etibarsızdır");
        }
        boolean created = false;
        AppUser u = users.findByTaxIdIgnoreCase(id.fin()).orElse(null);
        if (u == null) {
            String email = id.email() != null && !users.existsByEmailIgnoreCase(id.email())
                    ? id.email().toLowerCase(Locale.ROOT)
                    : id.fin().toLowerCase(Locale.ROOT) + "@mygov.local";
            u = new AppUser(email, encoder.encode(UUID.randomUUID().toString()), id.fullName(), Role.INVESTOR);
            u.setPhone(id.phone());
            u.setTaxId(id.fin());
            users.save(u);
            notifications.notify(u, "Hesabınız myGov ilə yaradıldı", "Şəxsiyyətiniz dövlət identifikasiya sistemi ilə təsdiqləndi. Müraciət formasında məlumatlarınız avtomatik doldurulacaq.", "/kabinet");
            created = true;
        }
        UsernamePasswordAuthenticationToken auth = UsernamePasswordAuthenticationToken.authenticated(u.getEmail(), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        establishSession(auth, req, res);
        audit.logAs(u.getEmail(), created ? "REGISTERED_MYGOV" : "LOGIN_MYGOV", "AppUser", u.getId(), "FİN ilə identifikasiya");
        return Map.of("user", toDto(u), "created", created);
    }

    @Operation(summary = "Çıxış")
    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest req) {
        audit.log("LOGOUT", "AppUser", null, null);
        HttpSession session = req.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return Map.of("ok", true);
    }

    @Operation(summary = "Cari istifadəçi")
    @GetMapping("/me")
    public UserDto me() {
        return toDto(currentUser.require());
    }

    private void establishSession(Authentication auth, HttpServletRequest req, HttpServletResponse res) {
        req.getSession(true);
        req.changeSessionId(); // session fixation protection
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
        contextRepository.saveContext(ctx, req, res);
    }

    private UserDto toDto(AppUser u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole().name(), u.getRole().getLabel(), u.getPhone(), u.getTaxId(),
                notifications.unreadCount(u.getId()));
    }
}
