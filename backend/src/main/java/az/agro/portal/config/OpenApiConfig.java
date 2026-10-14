package az.agro.portal.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI portalOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Qarabağ Aqrar İnvestisiya Portalı API")
                        .version("v1")
                        .description("""
                                İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı investisiya müsabiqəsi portalının REST API-si.

                                * **İctimai API** — giriş tələb etmir.
                                * **Şəxsi kabinet / İnzibati panel** — sessiya cookie-si (`/api/v1/auth/login`).
                                * **EKTİS inteqrasiyası** — sistemlərarası çağırışlar, `X-API-Key` başlığı ilə.
                                """)
                        .contact(new Contact().name("Hakaton komandası")))
                .components(new Components()
                        .addSecuritySchemes("apiKey", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER).name("X-API-Key"))
                        .addSecuritySchemes("session", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE).name("JSESSIONID")));
    }
}
