package az.agro.portal.service;

import az.agro.portal.ai.CropRecommendation;
import az.agro.portal.ai.CropRecommendationService;
import az.agro.portal.ai.SoilClimate;
import az.agro.portal.domain.*;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.security.CurrentUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Portal assistant. Answers are grounded in the portal's own data, the official statistics and the ANAMA layer:
 * a retrieval step finds the facts, then either a built-in template writes the answer (no key, works offline)
 * or, when a free LLM API key is configured, the LLM rephrases ONLY those facts.
 */
@Service
public class AssistantService {

    private static final Logger log = LoggerFactory.getLogger(AssistantService.class);

    public record Link(String label, String url) {
    }

    public record Reply(String answer, List<Link> links, List<String> sources, List<String> suggestions, String engine) {
    }

    private record Facts(String intent, List<String> lines, List<Link> links, List<String> sources) {
    }

    private static final Locale AZ = Locale.forLanguageTag("az");

    private static final List<String> DISTRICTS = List.of("Ağdam", "Füzuli", "Xocavənd", "Xocalı", "Şuşa", "Tərtər", "Ağcabədi", "Bərdə", "Xankəndi");

    /** keyword stem (normalised) → [indicator key, crop label] */
    private static final Map<String, String[]> CROP_WORDS = new LinkedHashMap<>();

    static {
        CROP_WORDS.put("bugda", new String[]{"wheat_yield", "buğda"});
        CROP_WORDS.put("arpa", new String[]{"barley_yield", "arpa"});
        CROP_WORDS.put("qargidal", new String[]{"maize_yield", "qarğıdalı"});
        CROP_WORDS.put("noxud", new String[]{"chickpea_yield", "noxud"});
        CROP_WORDS.put("mercimek", new String[]{"lentil_yield", "mərcimək"});
        CROP_WORDS.put("lobya", new String[]{"bean_yield", "lobya"});
        CROP_WORDS.put("denli", new String[]{"grain_yield", "dənli bitkilər"});
        CROP_WORDS.put("meyve", new String[]{"fruit_prod", "meyvə və giləmeyvə"});
        CROP_WORDS.put("kartof", new String[]{"potato_prod", "kartof"});
        CROP_WORDS.put("qarpiz", new String[]{"watermelon_prod", "qarpız"});
        CROP_WORDS.put("yemis", new String[]{"melon_prod", "yemiş"});
    }

    private static final List<String> SUGGESTIONS = List.of(
            "Ağdamda buğdanın məhsuldarlığı nə qədərdir?",
            "Füzulidə hansı sahələr var?",
            "Hansı müsabiqələr açıqdır?",
            "Müraciət üçün hansı sənədlər lazımdır?",
            "Xocavənddə nə qədər ərazi minadan təmizlənib?",
            "Şuşada nə əkmək olar?");

    private final LandPlotRepository plots;
    private final CompetitionRepository competitions;
    private final ApplicationRepository applications;
    private final OfficialDataService official;
    private final CropRecommendationService ai;
    private final CurrentUser currentUser;
    private final String llmKey;
    private final String llmBaseUrl;
    private final String llmModel;

    public AssistantService(LandPlotRepository plots, CompetitionRepository competitions, ApplicationRepository applications,
                            OfficialDataService official, CropRecommendationService ai, CurrentUser currentUser,
                            @Value("${app.assistant.llm.api-key:}") String llmKey,
                            @Value("${app.assistant.llm.base-url:https://api.groq.com/openai/v1}") String llmBaseUrl,
                            @Value("${app.assistant.llm.model:llama-3.1-8b-instant}") String llmModel) {
        this.plots = plots;
        this.competitions = competitions;
        this.applications = applications;
        this.official = official;
        this.ai = ai;
        this.currentUser = currentUser;
        this.llmKey = llmKey;
        this.llmBaseUrl = llmBaseUrl;
        this.llmModel = llmModel;
    }

    public boolean llmEnabled() {
        return llmKey != null && !llmKey.isBlank();
    }

    @Transactional(readOnly = true)
    public Reply ask(String question) {
        String q = norm(question);
        Facts facts = retrieve(q);
        String answer = String.join("\n", facts.lines());
        String engine = "built-in";
        if (llmEnabled() && !facts.intent().equals("help")) {
            try {
                answer = llm(question, facts);
                engine = "llm:" + llmModel;
            } catch (Exception e) {
                log.warn("LLM unavailable, using built-in answer: {}", e.getMessage());
            }
        }
        return new Reply(answer, facts.links(), facts.sources(), suggestionsFor(facts.intent()), engine);
    }

    // ---------------------------------------------------------------- retrieval

    private Facts retrieve(String q) {
        String district = DISTRICTS.stream().filter(d -> q.contains(norm(d).substring(0, Math.min(5, norm(d).length())))).findFirst().orElse(null);
        Map.Entry<String, String[]> crop = CROP_WORDS.entrySet().stream().filter(e -> q.contains(e.getKey())).findFirst().orElse(null);

        if (has(q, "salam", "kimsen", "ne ede biler", "komek")) return help();
        if (has(q, "sened", "senedler", "lazimdir", "teleb olunur")) return documents();
        if (has(q, "mygov", "asan", "giris", "daxil ol", "qeydiyyat")) return login();
        if (has(q, "muraciet") && has(q, "status", "veziyyet", "menim")) return myApplications();
        if (has(q, "nece muraciet", "muraciet etmek", "muraciet edim", "muraciet qaydasi")) return howToApply();
        if (has(q, "mina", "temizlen", "anama")) return demining(district);
        if (crop != null && (has(q, "mehsuldar", "istehsal", "nece ton", "sentner", "statistika") || district != null)) {
            return statistics(crop.getValue()[0], crop.getValue()[1], district);
        }
        if (has(q, "ne ekmek", "ne ekim", "hansi bitki", "ne ekmeli", "tovsiye", "uygun bitki")) return planting(district);
        if (has(q, "musabiqe", "son tarix", "deadline", "aciq")) return competitions();
        if (has(q, "sahe", "torpaq", "hektar", "icare") || district != null) return plotsIn(district);
        if (has(q, "statistika", "investisiya", "is yeri")) return portalStats();
        return fallback();
    }

    private Facts help() {
        return new Facts("help", List.of(
                "Salam! Mən Aqrar İnvest portalının köməkçisiyəm. Cavablarım portalın məlumat bazasına, Dövlət Statistika Komitəsinin rəsmi statistikasına və ANAMA-nın açıq məlumatlarına əsaslanır.",
                "Soruşa bilərsiniz: rayonlar üzrə sahələr, açıq müsabiqələr, bitkilərin rəsmi məhsuldarlığı, minadan təmizlənmiş ərazilər, nə əkmək uyğundur, müraciət qaydası və sənədlər."),
                List.of(new Link("Xəritə", "/xerite"), new Link("Kataloq", "/kataloq")), List.of());
    }

    private Facts documents() {
        return new Facts("faq", List.of(
                "Elektron müraciət üçün məcburi sənədlər: biznes plan (PDF/DOCX) və şəxsiyyət vəsiqəsi.",
                "Hüquqi şəxslər əlavə olaraq dövlət qeydiyyatı şəhadətnaməsini təqdim edir. Maliyyə imkanını təsdiq edən sənəd tövsiyə olunur.",
                "Fayllar 5 MB-a qədər, PDF, JPG, PNG və ya DOCX formatında olmalıdır; sistem faylın həqiqi formatını yoxlayır."),
                List.of(new Link("Kataloqdan sahə seçin", "/kataloq")), List.of("Portalın müsabiqə qaydaları"));
    }

    private Facts login() {
        return new Facts("faq", List.of(
                "Portala iki yolla daxil olmaq olar: myGov (dövlət identifikasiyası) və ya e-poçt ilə qeydiyyat.",
                "myGov ilə daxil olduqda FİN və telefon müraciət formasına avtomatik doldurulur. Demo versiyada myGov simulyasiya ilə işləyir."),
                List.of(new Link("Daxil ol", "/giris")), List.of());
    }

    private Facts howToApply() {
        return new Facts("faq", List.of(
                "Müraciət 5 addımdan ibarətdir: sahə və fəaliyyət, müraciətçi məlumatları, biznes plan, sənədlər, təsdiq.",
                "Göndərdikdən sonra qeydiyyat nömrəsi və QR kodlu qəbz verilir, müraciət EKTİS-ə ötürülür. Statusu şəxsi kabinetdən izləyirsiniz: Qəbul edilib, Baxılır, Əlavə məlumat tələb olunur, Qərar verilib."),
                List.of(new Link("Açıq müsabiqələr", "/musabiqeler"), new Link("Kabinetim", "/kabinet")), List.of());
    }

    private Facts myApplications() {
        AppUser me = currentUser.find().orElse(null);
        if (me == null) {
            return new Facts("mine", List.of("Müraciətlərinizin statusunu görmək üçün əvvəlcə portala daxil olun."),
                    List.of(new Link("Daxil ol", "/giris")), List.of());
        }
        List<InvestmentApplication> mine = applications.findByApplicantIdOrderByCreatedAtDesc(me.getId());
        if (mine.isEmpty()) {
            return new Facts("mine", List.of("Hələ müraciətiniz yoxdur."), List.of(new Link("Sahə seçin", "/kataloq")), List.of());
        }
        List<String> lines = new ArrayList<>();
        lines.add("Müraciətləriniz:");
        mine.forEach(a -> lines.add("• " + a.getApplicationNumber() + ", " + a.getPlot().getTitle() + ": " + a.getStatus().getLabel()));
        return new Facts("mine", lines, mine.stream().limit(3).map(a -> new Link(a.getApplicationNumber(), "/kabinet/" + a.getId())).toList(),
                List.of("Portalın məlumat bazası"));
    }

    private Facts demining(String district) {
        Map<String, Object[]> s = official.anamaSummary();
        List<String> lines = new ArrayList<>();
        if (district != null && s.containsKey(district)) {
            Object[] a = s.get(district);
            lines.add(district + " rayonunda Kənd Təsərrüfatı Nazirliyinin sifarişi ilə " + a[0] + " sahə, cəmi " + fmt((double) Math.round((Double) a[1]))
                    + " ha ərazi minadan təmizlənib və sertifikatlaşdırılıb. Ən son sertifikat: " + a[2] + ".");
        } else {
            lines.add("Qarabağ iqtisadi rayonunda Kənd Təsərrüfatı Nazirliyinin sifarişi ilə minadan təmizlənmiş kənd təsərrüfatı sahələri:");
            s.forEach((d, a) -> lines.add("• " + d + ": " + a[0] + " sahə, " + fmt((double) Math.round((Double) a[1])) + " ha"));
        }
        lines.add("Bu sahələrin sərhədləri xəritədə \"ANAMA\" qatında göstərilir.");
        return new Facts("demining", lines, List.of(new Link("Xəritədə bax", "/xerite")),
                List.of("ANAMA, \"İşğaldan azad olunmuş ərazilərdə təmizlənmiş və sertifikatlaşdırılmış sahələrin sərhədləri\", opendata.az (ODC-BY)"));
    }

    private Facts statistics(String key, String cropLabel, String district) {
        String[] meta = OfficialDataService.INDICATORS.get(key);
        List<String> lines = new ArrayList<>();
        if (district != null) {
            var summary = official.district(district).stream().filter(i -> i.key().equals(key)).findFirst();
            if (summary.isPresent()) {
                var i = summary.get();
                lines.add(String.format(Locale.ROOT, "%s rayonunda %s: %s %s (%d-ci il).", district, meta[0].toLowerCase(AZ), fmt(i.district()), i.unit(), i.year()));
                if (i.national() != null) lines.add(String.format(Locale.ROOT, "Müqayisə üçün ölkə üzrə: %s %s.", fmt(i.national()), i.unit()));
                if (i.series().size() > 2) {
                    var first = i.series().get(0);
                    lines.add(String.format(Locale.ROOT, "%d-ci ildə bu göstərici %s %s idi.", first.year(), fmt(first.value()), i.unit()));
                }
            } else {
                lines.add(district + " rayonu üzrə " + meta[0].toLowerCase(AZ) + " göstəricisi rəsmi statistikada yoxdur (rayon işğal dövründə uçota alınmayıb və ya bu bitki becərilmir).");
                official.latest(key, "Azərbaycan Respublikası").ifPresent(v -> lines.add("Ölkə üzrə son göstərici: " + fmt(v) + " " + meta[1] + "."));
            }
        } else {
            official.latest(key, "Azərbaycan Respublikası").ifPresent(v -> lines.add("Ölkə üzrə " + meta[0].toLowerCase(AZ) + ": " + fmt(v) + " " + meta[1] + " (son il)."));
            official.latest(key, "Qarabağ iqtisadi rayonu").ifPresent(v -> lines.add("Qarabağ iqtisadi rayonu üzrə: " + fmt(v) + " " + meta[1] + "."));
            lines.add("Rayon adını yazsanız (məsələn, \"Ağdamda " + cropLabel + "\"), həmin rayon üzrə göstəriləcək.");
        }
        return new Facts("stats", lines, List.of(new Link("Şəffaflıq səhifəsi", "/seffafliq")),
                List.of("Dövlət Statistika Komitəsi, azstat.gov.az açıq məlumat API-si (CC0), opendata.az"));
    }

    private Facts planting(String district) {
        List<LandPlot> list = district == null ? plots.findAll() : plots.findAll().stream().filter(p -> p.getDistrict().equals(district)).toList();
        if (list.isEmpty()) return plotsIn(district);
        Map<String, Long> votes = list.stream().map(p -> ai.recommend(SoilClimate.of(p)).best())
                .filter(Objects::nonNull).collect(Collectors.groupingBy(CropRecommendation.CropScore::name, Collectors.counting()));
        List<String> lines = new ArrayList<>();
        lines.add((district == null ? "Portaldakı sahələr" : district + " rayonundakı sahələr") + " üçün AI modelinin tövsiyələri (torpaq və iqlim göstəricilərinə görə):");
        votes.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .forEach(e -> lines.add("• " + e.getKey() + ": " + e.getValue() + " sahədə ən uyğun bitki"));
        lines.add("Konkret sahə üçün ehtimallarla tövsiyəni sahənin səhifəsində və \"Məsləhətçi\" bölməsində görə bilərsiniz.");
        return new Facts("planting", lines, List.of(new Link("AI məsləhətçi", "/ai")),
                List.of("Portalın AI modeli (RandomForest, Kaggle datasetində öyrədilib)"));
    }

    private Facts competitions() {
        List<Competition> open = competitions.findByStatusOrderByDeadlineAsc(CompetitionStatus.PUBLISHED).stream().filter(Competition::isOpen).toList();
        if (open.isEmpty()) return new Facts("competitions", List.of("Hazırda açıq müsabiqə yoxdur."), List.of(), List.of());
        List<String> lines = new ArrayList<>();
        lines.add("Açıq müsabiqələr:");
        open.forEach(c -> lines.add("• " + c.getTitle() + ": " + c.getPlots().size() + " sahə, son tarix " + c.getDeadline()
                + " (" + ChronoUnit.DAYS.between(LocalDate.now(), c.getDeadline()) + " gün qalıb)"));
        return new Facts("competitions", lines, List.of(new Link("Müsabiqələr", "/musabiqeler")), List.of("Portalın məlumat bazası"));
    }

    private Facts plotsIn(String district) {
        List<LandPlot> list = plots.findAll().stream().filter(p -> district == null || p.getDistrict().equals(district))
                .sorted(Comparator.comparingDouble(LandPlot::getAreaHa).reversed()).toList();
        List<String> lines = new ArrayList<>();
        if (list.isEmpty()) {
            lines.add((district == null ? "Portalda" : district + " rayonunda") + " hazırda təklif olunan sahə yoxdur.");
        } else {
            lines.add((district == null ? "Portalda " : district + " rayonunda ") + list.size() + " sahə təklif olunur, cəmi "
                    + Math.round(list.stream().mapToDouble(LandPlot::getAreaHa).sum()) + " ha:");
            list.stream().limit(6).forEach(p -> lines.add("• " + p.getTitle() + ": " + Math.round(p.getAreaHa()) + " ha, "
                    + p.getActivityType().getLabel().toLowerCase(AZ)
                    + (p.getMineClearanceDate() != null ? ", minadan təmizlənib " + p.getMineClearanceDate() : "")));
            lines.add("Sahələrin sərhədləri ANAMA-nın rəsmi məlumatlarından götürülüb.");
        }
        List<Link> links = list.stream().limit(3).map(p -> new Link(p.getTitle(), "/sahe/" + p.getId())).collect(Collectors.toCollection(ArrayList::new));
        links.add(new Link("Kataloq", district == null ? "/kataloq" : "/kataloq?q=" + district));
        return new Facts("plots", lines, links, List.of("Portalın məlumat bazası", "ANAMA, opendata.az"));
    }

    private Facts portalStats() {
        List<InvestmentApplication> apps = applications.findAll();
        long inv = apps.stream().mapToLong(InvestmentApplication::getPlannedInvestment).sum();
        int jobs = apps.stream().mapToInt(InvestmentApplication::getJobsCreated).sum();
        return new Facts("portal", List.of(
                "Portalda " + plots.count() + " sahə, " + apps.size() + " müraciət var.",
                "Planlaşdırılan investisiya: " + String.format(Locale.ROOT, "%,d", inv).replace(',', ' ') + " ₼, yeni iş yerləri: " + jobs + "."),
                List.of(new Link("Şəffaflıq", "/seffafliq")), List.of("Portalın məlumat bazası"));
    }

    private Facts fallback() {
        return new Facts("fallback", List.of(
                "Bu sualı tam başa düşmədim. Rayon və ya bitki adı ilə soruşmağa çalışın, məsələn: \"Füzulidə qarğıdalının məhsuldarlığı\" və ya \"Ağdamda hansı sahələr var\"."),
                List.of(), List.of());
    }

    // ---------------------------------------------------------------- optional free LLM (OpenAI-compatible, e.g. Groq)

    private String llm(String question, Facts facts) {
        SimpleClientHttpRequestFactory timeouts = new SimpleClientHttpRequestFactory();
        timeouts.setConnectTimeout(4000);
        timeouts.setReadTimeout(12000);
        RestClient http = RestClient.builder().baseUrl(llmBaseUrl).requestFactory(timeouts)
                .defaultHeader("Authorization", "Bearer " + llmKey).build();
        String system = "Sən Azərbaycanın kənd təsərrüfatı investisiya portalının köməkçisisən. YALNIZ aşağıdakı FAKTLAR əsasında, "
                + "Azərbaycan dilində, qısa və dəqiq cavab ver. Faktlarda olmayan rəqəm, ad və ya tarix uydurma. "
                + "Cavab faktlarda yoxdursa, bunu açıq de.\n\nFAKTLAR:\n" + String.join("\n", facts.lines())
                + "\n\nMƏNBƏLƏR: " + String.join("; ", facts.sources());
        Map<String, Object> body = Map.of("model", llmModel, "temperature", 0.2, "max_tokens", 400,
                "messages", List.of(Map.of("role", "system", "content", system), Map.of("role", "user", "content", question)));
        Map<String, Object> res = http.post().uri("/chat/completions").contentType(MediaType.APPLICATION_JSON).body(body)
                .retrieve().body(new ParameterizedTypeReference<Map<String, Object>>() {
                });
        @SuppressWarnings("unchecked")
        var choice = ((List<Map<String, Object>>) res.get("choices")).get(0);
        @SuppressWarnings("unchecked")
        String content = (String) ((Map<String, Object>) choice.get("message")).get("content");
        return content == null || content.isBlank() ? String.join("\n", facts.lines()) : content.trim();
    }

    // ---------------------------------------------------------------- helpers

    private List<String> suggestionsFor(String intent) {
        return SUGGESTIONS.stream().filter(s -> !norm(s).contains(intent)).limit(3).toList();
    }

    private static boolean has(String q, String... words) {
        for (String w : words) if (q.contains(w)) return true;
        return false;
    }

    /** Lower-case and fold Azerbaijani letters so "Buğda", "bugda" and "BUĞDA" all match. */
    static String norm(String s) {
        if (s == null) return "";
        return s.toLowerCase(AZ).replace('ə', 'e').replace('ı', 'i').replace('ö', 'o').replace('ü', 'u')
                .replace('ş', 's').replace('ç', 'c').replace('ğ', 'g').replace("i̇", "i").replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    private static String fmt(Double v) {
        if (v == null) return "yoxdur";
        return v == Math.rint(v) ? String.format(Locale.ROOT, "%,.0f", v).replace(',', ' ') : String.format(Locale.ROOT, "%.1f", v).replace('.', ',');
    }
}
