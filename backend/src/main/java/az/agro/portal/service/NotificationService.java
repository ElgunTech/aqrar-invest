package az.agro.portal.service;

import az.agro.portal.domain.AppUser;
import az.agro.portal.domain.Notification;
import az.agro.portal.repo.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * In-portal notifications. In production the same call would also fan out to e-mail / SMS
 * (e.g. through a message queue) — the call sites would not change.
 */
@Service
public class NotificationService {

    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) {
        this.repo = repo;
    }

    public void notify(AppUser user, String title, String message, String link) {
        repo.save(new Notification(user, title, message, link));
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
