package az.agro.portal.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Sends an e-mail copy of a portal notification. Off when SMTP credentials or the sender are not configured,
 * and never for the seeded demo accounts (@demo.az). Sending runs off the request thread; a failure is only logged.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final String from;
    private final String password;
    private final String publicUrl;
    private final ExecutorService pool = Executors.newSingleThreadExecutor();

    public MailService(JavaMailSender sender,
                       @Value("${app.mail.from:}") String from,
                       @Value("${spring.mail.password:}") String password,
                       @Value("${app.mail.public-url:}") String publicUrl) {
        this.sender = sender;
        this.from = from;
        this.password = password;
        this.publicUrl = publicUrl.replaceAll("/$", "");
    }

    public boolean enabled() {
        return !from.isBlank() && !password.isBlank();
    }

    public void send(String to, String title, String message, String link) {
        if (!enabled() || to == null || !to.contains("@") || to.endsWith("@demo.az")) return;
        pool.submit(() -> {
            try {
                MimeMessage mime = sender.createMimeMessage();
                MimeMessageHelper h = new MimeMessageHelper(mime, false, StandardCharsets.UTF_8.name());
                h.setFrom(from, "Aqrar İnvest portalı");
                h.setTo(to);
                h.setSubject(title);
                h.setText(html(title, message, link), true);
                sender.send(mime);
                log.info("Notification e-mail sent: {}", title);
            } catch (Exception e) {
                log.warn("Notification e-mail failed: {}", e.getMessage());
            }
        });
    }

    private String html(String title, String message, String link) {
        String url = link == null ? publicUrl : publicUrl + link;
        return """
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #dfe5e1">
              <div style="background:#1d7a3e;color:#fff;padding:16px 20px;font-weight:bold">AQRAR İNVEST · İnvestisiya müsabiqəsi portalı</div>
              <div style="padding:20px;color:#1c2420">
                <h2 style="font-size:18px;margin:0 0 10px">%s</h2>
                <p style="font-size:14px;line-height:1.5;margin:0 0 18px">%s</p>
                <a href="%s" style="background:#1d7a3e;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;font-size:14px">Portalda bax</a>
              </div>
              <div style="padding:12px 20px;font-size:12px;color:#6b766f;border-top:1px solid #dfe5e1">Bu məktub avtomatik göndərilib. Bildiriş ayarları: şəxsi kabinet.</div>
            </div>""".formatted(HtmlUtils.htmlEscape(title), HtmlUtils.htmlEscape(message), HtmlUtils.htmlEscape(url));
    }
}
