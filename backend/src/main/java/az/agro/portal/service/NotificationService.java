package az.agro.portal.service;

import az.agro.portal.domain.AppUser;
import az.agro.portal.domain.Notification;
import az.agro.portal.repo.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * In-portal notifications, each also sent as an e-mail when SMTP is configured (see MailService). SMS would plug in here
 * (e.g. through a message queue) — the call sites would not change.
 */
@Service
public class NotificationService {

    private final NotificationRepository repo;
    private final MailService mail;

    public NotificationService(NotificationRepository repo, MailService mail) {
        this.mail = mail;
        this.repo = repo;
    }

    public void notify(AppUser user, String title, String message, String link) {
        repo.save(new Notification(user, title, message, link));
        mail.send(user.getEmail(), title, message, link);
    }

    @Transactional(readOnly = true)
    public List<Notification> latest(Long userId) {
        return repo.findTop50ByRecipientIdOrderByCreatedAtDesc(userId);
    }

    public long unreadCount(Long userId) {
        return repo.countByRecipientIdAndReadFalse(userId);
    }

    @Transactional
    public void markAllRead(Long userId) {
        repo.findByRecipientIdAndReadFalse(userId).forEach(n -> n.setRead(true));
    }
}
