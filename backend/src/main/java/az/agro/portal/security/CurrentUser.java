package az.agro.portal.security;

import az.agro.portal.domain.AppUser;
import az.agro.portal.repo.AppUserRepository;
import az.agro.portal.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class CurrentUser {

    private final AppUserRepository users;

    public CurrentUser(AppUserRepository users) {
        this.users = users;
    }

    public Optional<AppUser> find() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        return users.findByEmailIgnoreCase(auth.getName());
    }

    public AppUser require() {
        return find().orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Daxil olmaq tələb olunur"));
    }

    /** Name for audit / history entries: the logged-in e-mail or "system". */
    public String nameOrSystem() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || auth instanceof AnonymousAuthenticationToken ? "system" : auth.getName();
    }
}
