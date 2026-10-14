package az.agro.portal.config;

import az.agro.portal.domain.*;
import az.agro.portal.repo.AppUserRepository;
import az.agro.portal.repo.ApplicationRepository;
import az.agro.portal.repo.CompetitionRepository;
import az.agro.portal.repo.EvaluatorScoreRepository;
import az.agro.portal.repo.MilestoneRepository;
import az.agro.portal.service.MonitoringService;
import az.agro.portal.repo.LandPlotRepository;
import az.agro.portal.service.ApplicationScorer;
import az.agro.portal.service.FileStorageService;
import az.agro.portal.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Seeds realistic demo data on first start (empty database): users of every role, plots in the liberated
 * districts of the Karabakh economic region, competitions in different states and applications.
 * Demo logins are listed in README.md.
 */
@Component
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final String DEMO_PASSWORD = "Demo12345";

    private final AppUserRepository users;
    private final LandPlotRepository plots;
    private final CompetitionRepository competitions;
    private final ApplicationRepository applications;
    private final PasswordEncoder encoder;
    private final FileStorageService files;
    private final ApplicationScorer scorer;
    private final NotificationService notifications;
    private final boolean enabled;
    private final EvaluatorScoreRepository scores;
    private final MonitoringService monitoring;
    private final MilestoneRepository milestones;
    @org.springframework.beans.factory.annotation.Autowired
    private az.agro.portal.service.LedgerService ledger;

    public DemoDataSeeder(MonitoringService monitoring, MilestoneRepository milestones, EvaluatorScoreRepository scores, AppUserRepository users, LandPlotRepository plots, CompetitionRepository competitions,
                          ApplicationRepository applications, PasswordEncoder encoder, FileStorageService files,
                          ApplicationScorer scorer, NotificationService notifications,
                          @Value("${app.seed-demo-data}") boolean enabled) {
        this.scores = scores;
        this.monitoring = monitoring;
        this.milestones = milestones;
        this.users = users;
        this.plots = plots;
        this.competitions = competitions;
        this.applications = applications;
        this.encoder = encoder;
        this.files = files;
        this.scorer = scorer;
        this.notifications = notifications;
        this.enabled = enabled;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled || users.count() > 0) return;
        log.info("Seeding demo data...");

        AppUser admin = user("admin@demo.az", "Şükürov Elgün", Role.ADMIN, "+994 50 111 11 11", null);
        AppUser evaluator = user("evaluator@demo.az", "Qurbanov Rafael", Role.EVALUATOR, "+994 50 222 22 22", null);
        AppUser investor = user("investor@demo.az", "Rəşad Məmmədov", Role.INVESTOR, "+994 55 333 33 33", "5ZK7QWE");
        AppUser company = user("aqro@demo.az", "Qarabağ Aqro MMC", Role.INVESTOR, "+994 12 444 44 44", "1402567891");
        AppUser leyla = user("leyla@demo.az", "Leyla Hüseynova", Role.INVESTOR, "+994 70 555 55 55", "7AB3XYZ");

        // Soil/climate profiles: N, P, K, temperature, humidity, pH, rainfall
        double[] cotton = {118, 46, 20, 24.2, 79, 6.9, 79};
        double[] maize = {79, 47, 20, 22.3, 65, 6.2, 86};
        double[] grapes = {24, 131, 199, 23.6, 81, 6.0, 69};
        double[] apple = {21, 133, 200, 22.4, 92, 5.9, 112};
        double[] pomegranate = {19, 19, 41, 21.9, 90, 6.4, 106};
        double[] melon = {99, 18, 50, 26.0, 88, 6.5, 45};
        double[] chickpea = {41, 68, 80, 19.0, 17, 7.3, 80};
        double[] lentil = {19, 67, 19, 24.4, 64, 6.9, 47};
        double[] fodder = {72, 46, 22, 21.0, 62, 6.5, 92};

        LandPlot agd1 = plot("QR-AGD-001", "02-104-0011-017", "Kəngərli pambıq massivi", "Ağdam", "Kəngərli", 39.985, 47.020, 140,
                ActivityType.CROP_FARMING, "Boz-çəmən", cotton, 0.6, 1.5, true, true, MineClearanceStatus.CLEARED, "2023-05-12", 25, 650_000,
                "Düzənlik massiv, Qarqarçay suvarma kanalına yaxın. Pambıq və texniki bitkilər üçün əlverişlidir.");
        LandPlot agd2 = plot("QR-AGD-002", "02-104-0023-004", "Baş Qərvənd dənli bitkilər sahəsi", "Ağdam", "Baş Qərvənd", 40.030, 46.990, 85,
                ActivityType.CROP_FARMING, "Şabalıdı", maize, 1.8, 0.9, true, true, MineClearanceStatus.CLEARED, "2023-09-01", 20, 380_000,
                "Qarğıdalı və yem bitkiləri üçün. Ağdam–Bərdə yoluna 1 km.");
        LandPlot agd3 = plot("QR-AGD-003", "02-104-0031-009", "Sarıcalı maldarlıq kompleksi sahəsi", "Ağdam", "Sarıcalı", 39.960, 46.880, 60,
                ActivityType.LIVESTOCK, "Dağ-çəmən", fodder, 2.5, 3.0, false, true, MineClearanceStatus.IN_PROGRESS, null, 15, 450_000,
                "Ət-süd istiqamətli iribuynuzlu heyvandarlıq kompleksi və yem bazası üçün.");
        LandPlot agd4 = plot("QR-AGD-004", "02-104-0042-002", "Papravənd paxlalılar sahəsi", "Ağdam", "Papravənd", 40.060, 47.060, 45,
                ActivityType.CROP_FARMING, "Açıq şabalıdı", lentil, 3.2, 2.2, false, false, MineClearanceStatus.CLEARED, "2024-03-20", 15, 150_000,
                "Mərcimək və digər paxlalı bitkilər üçün. Kiçik və orta sahibkarlar üçün başlanğıc sahə.");
        LandPlot agd5 = plot("QR-AGD-005", "02-104-0057-011", "Xıdırlı aqropark sahəsi", "Ağdam", "Xıdırlı", 40.000, 47.100, 200,
                ActivityType.CROP_FARMING, "Boz-çəmən", new double[]{112, 42, 19, 24.8, 78, 7.0, 76}, 1.3, 2.0, true, true,
                MineClearanceStatus.CLEARED, "2023-10-10", 25, 900_000,
                "Böyük həcmli aqropark üçün: pambıq, emal və saxlama infrastrukturu.");
        LandPlot fzl1 = plot("QR-FZL-001", "07-201-0012-003", "Dövlətyarlı üzüm bağı sahəsi", "Füzuli", "Dövlətyarlı", 39.620, 47.180, 95,
                ActivityType.VITICULTURE, "Qəhvəyi dağ-meşə", grapes, 1.2, 0.7, true, true, MineClearanceStatus.CLEARED, "2022-11-15", 30, 720_000,
                "Süfrə və texniki üzüm sortları, şərab emalı sexi üçün yer ayrılıb.");
        LandPlot fzl2 = plot("QR-FZL-002", "07-201-0026-008", "Qaraxanbəyli nar bağı sahəsi", "Füzuli", "Qaraxanbəyli", 39.580, 47.240, 70,
                ActivityType.HORTICULTURE, "Boz-qəhvəyi", pomegranate, 1.0, 1.8, true, true, MineClearanceStatus.CLEARED, "2023-02-10", 25, 520_000,
                "Nar bağı və soyuducu anbar üçün. Füzuli hava limanına 15 km.");
        LandPlot fzl3 = plot("QR-FZL-003", "07-201-0038-001", "Alxanlı dənli-paxlalı massivi", "Füzuli", "Alxanlı", 39.550, 47.320, 150,
                ActivityType.CROP_FARMING, "Açıq şabalıdı", chickpea, 4.5, 2.8, false, false, MineClearanceStatus.IN_PROGRESS, null, 20, 400_000,
                "Dəmyə şəraitində noxud və dənli bitkilər üçün.");
        LandPlot fzl4 = plot("QR-FZL-004", "07-201-0044-006", "Dədəli istixana kompleksi sahəsi", "Füzuli", "Dədəli", 39.640, 47.080, 30,
                ActivityType.GREENHOUSE, "Boz-çəmən", melon, 0.5, 0.4, true, true, MineClearanceStatus.CLEARED, "2024-01-15", 15, 900_000,
                "Müasir istixana kompleksi (tərəvəz, bostan). Elektrik və qaz xəttinə qoşulma mümkündür.");
        LandPlot xcv1 = plot("QR-XCV-001", "09-305-0010-002", "Hadrut üzümçülük sahəsi", "Xocavənd", "Hadrut", 39.520, 47.030, 55,
                ActivityType.VITICULTURE, "Qəhvəyi dağ-meşə", new double[]{22, 128, 201, 23.1, 83, 6.1, 72}, 1.5, 1.0, true, true,
                MineClearanceStatus.CLEARED, "2023-06-01", 30, 480_000,
                "Ənənəvi üzümçülük bölgəsi. Dağətəyi yamaclar, yaxşı günəş ekspozisiyası.");
        LandPlot xcv2 = plot("QR-XCV-002", "09-305-0021-005", "Tuğ arıçılıq və çəmənlik sahəsi", "Xocavənd", "Tuğ", 39.560, 47.080, 40,
                ActivityType.BEEKEEPING, "Dağ-çəmən", apple, 2.0, 3.5, false, false, MineClearanceStatus.CLEARED, "2024-05-10", 10, 80_000,
                "Dağ çəmənlikləri, arıçılıq və bal emalı üçün.");
        LandPlot xcl1 = plot("QR-XCL-001", "10-402-0015-001", "Ballıca meyvə bağı sahəsi", "Xocalı", "Ballıca", 39.930, 46.830, 65,
                ActivityType.HORTICULTURE, "Qəhvəyi dağ-meşə", apple, 1.1, 1.4, true, true, MineClearanceStatus.CLEARED, "2024-02-01", 25, 430_000,
                "İntensiv alma bağı, damcı suvarma sistemi üçün uyğundur.");
        LandPlot xcl2 = plot("QR-XCL-002", "10-402-0027-004", "Əsgəran heyvandarlıq sahəsi", "Xocalı", "Əsgəran", 39.950, 46.860, 110,
                ActivityType.LIVESTOCK, "Dağ-çəmən", fodder, 2.0, 1.0, false, true, MineClearanceStatus.PLANNED, null, 20, 550_000,
                "Qoyunçuluq və yem bazası. Minadan təmizlənmə 2027-ci il üçün planlaşdırılıb.");
        LandPlot shs1 = plot("QR-SHS-001", "11-501-0008-002", "Daşaltı dağ meyvəçiliyi sahəsi", "Şuşa", "Daşaltı", 39.740, 46.730, 25,
                ActivityType.HORTICULTURE, "Qəhvəyi dağ-meşə", apple, 0.9, 2.0, true, true, MineClearanceStatus.CLEARED, "2022-08-20", 25, 260_000,
                "Alma, armud və giləmeyvə üçün. Turizm marşrutuna yaxın — aqroturizm imkanı.");
        LandPlot shs2 = plot("QR-SHS-002", "11-501-0014-007", "Turşsu arıçılıq sahəsi", "Xocavənd", "Turşsu", 39.780, 46.700, 35,
                ActivityType.BEEKEEPING, "Dağ-çəmən", apple, 0.3, 2.5, false, false, MineClearanceStatus.CLEARED, "2023-07-07", 10, 60_000,
                "Şuşa dağ balı brendi üçün. Turşsu bulağına yaxın.");
        LandPlot trt1 = plot("QR-TRT-001", "13-601-0019-003", "Suqovuşan suvarılan massiv", "Tərtər", "Suqovuşan", 40.300, 46.860, 75,
                ActivityType.CROP_FARMING, "Çəmən-boz", maize, 0.4, 1.2, true, true, MineClearanceStatus.CLEARED, "2023-04-04", 20, 350_000,
                "Sərsəng su anbarından suvarma. Qarğıdalı və yem bitkiləri üçün.");
        LandPlot trt2 = plot("QR-TRT-002", "13-601-0025-001", "Talış meyvə bağı sahəsi", "Tərtər", "Talış", 40.270, 46.800, 50,
                ActivityType.HORTICULTURE, "Qəhvəyi dağ-meşə", apple, 1.6, 2.1, true, false, MineClearanceStatus.IN_PROGRESS, null, 25, 310_000,
                "Dağətəyi meyvə bağı. Elektrik xəttinin çəkilməsi 2027-ci ildə planlaşdırılıb.");
        LandPlot xnk1 = plot("QR-XNK-001", "12-701-0004-002", "Xankəndi istixana sahəsi", "Tərtər", "Xankəndi ətrafı", 39.840, 46.800, 20,
                ActivityType.GREENHOUSE, "Boz-qəhvəyi", new double[]{100, 17, 50, 27.5, 90, 6.4, 30}, 0.7, 0.5, true, true,
                MineClearanceStatus.CLEARED, "2024-06-10", 15, 750_000,
                "Şəhərə yaxın istixana kompleksi — yerli bazara təzə məhsul.");

        LocalDate today = LocalDate.now();
        Competition c1 = competition("MQ-" + today.getYear() + "-001", "Ağdam və Tərtər: əkinçilik sahələri üzrə investisiya müsabiqəsi",
                "Ağdam və Tərtər rayonlarında suvarılan və dəmyə əkinçilik sahələrinin uzunmüddətli icarəyə verilməsi.",
                "Minimum investisiya həcmi hər sahə üçün göstərilib. Biznes plan, şəxsiyyəti təsdiq edən sənəd, hüquqi şəxslər üçün dövlət qeydiyyatı şəhadətnaməsi tələb olunur. Üstünlük: yerli iş yerlərinin yaradılması, müasir suvarma texnologiyaları.",
                today.minusDays(20), today.plusDays(28), CompetitionStatus.PUBLISHED, evaluator, admin, agd1, agd2, agd4, agd5, trt1);
        Competition c2 = competition("MQ-" + today.getYear() + "-002", "Füzuli, Xocavənd, Xocalı və Şuşa: bağçılıq, üzümçülük və istixana",
                "Yüksək əlavə dəyərli bağçılıq, üzümçülük və istixana layihələri üçün sahələr.",
                "Layihənin müddəti ən azı 5 il. Damcı suvarma və ixrac potensialı üstünlük sayılır. Sənədlər: biznes plan, şəxsiyyət vəsiqəsi, maliyyə imkanını təsdiq edən sənəd.",
                today.minusDays(15), today.plusDays(12), CompetitionStatus.PUBLISHED, evaluator, admin, fzl1, fzl2, fzl4, xcv1, xcl1, shs1, xnk1);
        competition("MQ-" + today.getYear() + "-003", "Heyvandarlıq və arıçılıq klasterləri",
                "Ağdam, Xocalı, Xocavənd və Şuşada heyvandarlıq və arıçılıq üçün sahələr.",
                "Baytarlıq xidmətinin təşkili və yem bazasının yaradılması planı tələb olunur.",
                today.plusDays(3), today.plusDays(45), CompetitionStatus.PENDING_APPROVAL, evaluator, null, agd3, xcl2, xcv2, shs2);
        Competition c4 = competition("MQ-" + (today.getYear() - 1) + "-004", "Pilot müsabiqə: dənli-paxlalı və meyvə sahələri",
                "Portalın pilot mərhələsində keçirilmiş müsabiqə.",
                "Biznes plan və şəxsiyyət vəsiqəsi.",
                today.minusDays(520), today.minusDays(450), CompetitionStatus.CLOSED, evaluator, admin, fzl3, trt2);

        Instant now = Instant.now();
        InvestmentApplication s1 = application(investor, c1, agd1, ApplicantType.INDIVIDUAL, "cotton", 720_000, 35, 18, 36, 8,
                ApplicationStatus.UNDER_REVIEW, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(9)), evaluator, null);
        application(company, c1, agd5, ApplicantType.COMPANY, "cotton", 1_250_000, 40, 45, 48, 11,
                ApplicationStatus.SUBMITTED, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(2)), null, null);
        InvestmentApplication s3 = application(leyla, c2, fzl2, ApplicantType.INDIVIDUAL, "pomegranate", 480_000, 20, 9, 60, 3,
                ApplicationStatus.INFO_REQUESTED, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(11)), evaluator,
                "Maliyyə imkanını təsdiq edən bank arayışını əlavə edin.");
        application(investor, c2, shs1, ApplicantType.INDIVIDUAL, "apple", 300_000, 30, 7, 36, 8,
                ApplicationStatus.SUBMITTED, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(1)), null, null);
        application(leyla, c1, trt1, ApplicantType.INDIVIDUAL, "maize", 360_000, 25, 6, 24, 3,
                ApplicationStatus.UNDER_REVIEW, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(6)), evaluator, null);
        InvestmentApplication s6 = application(company, c2, fzl1, ApplicantType.COMPANY, "grapes", 950_000, 45, 30, 60, 11,
                ApplicationStatus.UNDER_REVIEW, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(4)), evaluator, null);
        InvestmentApplication s7 = application(company, c4, fzl3, ApplicantType.COMPANY, "chickpea", 520_000, 40, 22, 36, 11,
                ApplicationStatus.APPROVED, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(437)), evaluator,
                "Komissiyanın qərarı ilə qalib elan edildi: ən yüksək investisiya və iş yeri göstəriciləri.");
        application(leyla, c4, trt2, ApplicantType.INDIVIDUAL, "apple", 150_000, 10, 3, 24, 3,
                ApplicationStatus.REJECTED, EktisSyncStatus.VERIFIED, now.minus(Duration.ofDays(460)), evaluator,
                "Planlaşdırılan investisiya minimum tələbdən (310 000 AZN) aşağıdır.");

        score(s1, evaluator, 8, 7, 7, 8, "Real biznes plan, pambıq emalı ilə inteqrasiya müsbətdir.");
        score(s6, evaluator, 9, 8, 8, 9, "Güclü komanda, ixrac müqavilələri var.");
        score(s6, admin, 8, 9, 7, 8, "Maliyyə mənbələri təsdiqlənib.");
        score(s7, evaluator, 8, 8, 9, 7, "Ən çox iş yeri yaradan layihə.");
        score(s7, admin, 9, 8, 8, 8, null);

        // Integrity demo: a new applicant shares Leyla's phone, copies her business plan, offers an implausibly
        // low amount and shares a surname with evaluator Qurbanov Rafael.
        AppUser suspicious = user("elcin@demo.az", "Elçin Qurbanov", Role.INVESTOR, "+994 70 555 55 55", "9KD4PLM");
        InvestmentApplication s9 = application(suspicious, c2, xcv1, ApplicantType.INDIVIDUAL, "grapes", 90_000, 5, 4, 24, 1,
                ApplicationStatus.SUBMITTED, EktisSyncStatus.VERIFIED, now.minus(Duration.ofHours(20)), null, null);
        s9.setBusinessPlan(s3.getBusinessPlan());

        // Post-award monitoring: the pilot winner was awarded 14 months ago. Milestone 1 reported and accepted,
        // milestone 2 (50% of the investment within 12 months) is overdue: the red light the ministry must act on.
        monitoring.createPlan(s7, LocalDate.now().minusMonths(14));
        var plan = milestones.findByApplicationIdOrderBySeq(s7.getId());
        FileStorageService.StoredFile photo = files.storeBytes("sahe-foto.png", fieldPhoto());
        plan.get(0).report("Torpaq şumlanıb, damcı suvarma xətti çəkilib (12 km). Nasos stansiyası quraşdırılıb.", 110_000,
                photo.storedName(), photo.originalName(), fzl3.getLatitude() + 0.002, fzl3.getLongitude() - 0.001, true, 250);
        plan.get(0).setReportedAt(Instant.now().minus(Duration.ofDays(230)));
        plan.get(0).review(true, "Səfər zamanı təsdiqləndi.", evaluator.getFullName());

        // Seal the seeded decisions into the tamper-evident ledger, oldest first.
        record Sealable(java.time.Instant at, Runnable seal) {}
        java.util.List<Sealable> seal = new java.util.ArrayList<>();
        for (InvestmentApplication app : applications.findAll()) {
            app.getHistory().forEach(c -> seal.add(new Sealable(c.getChangedAt(), () -> ledger.status(app, c))));
            // seeded scores are created now; date them before the decision they led to
            app.getHistory().stream().filter(c -> c.getToStatus() != null && c.getToStatus().isFinal()).findFirst().ifPresent(d ->
                    scores.findByApplicationIdOrderByUpdatedAtAsc(app.getId()).forEach(sc -> sc.setUpdatedAt(d.getChangedAt().minus(java.time.Duration.ofDays(2)))));
            scores.findByApplicationIdOrderByUpdatedAtAsc(app.getId()).forEach(sc -> seal.add(new Sealable(sc.getUpdatedAt(), () -> ledger.score(app, sc))));
        }
        seal.stream().sorted(java.util.Comparator.comparing(Sealable::at)).forEach(x -> x.seal().run());

        log.info("Demo data seeded: {} users, {} plots, {} competitions, {} applications",
                users.count(), plots.count(), competitions.count(), applications.count());
    }

    private AppUser user(String email, String name, Role role, String phone, String taxId) {
        AppUser u = new AppUser(email, encoder.encode(DEMO_PASSWORD), name, role);
        u.setPhone(phone);
        u.setTaxId(taxId);
        return users.save(u);
    }

    private LandPlot plot(String code, String cadastre, String title, String district, String village, double lat, double lng, double area,
                          ActivityType activity, String soil, double[] sc, double waterKm, double roadKm, boolean irrigation,
                          boolean electricity, MineClearanceStatus mine, String mineDate, int lease, long minInvestment, String description) {
        LandPlot p = new LandPlot();
        p.setCode(code);
        p.setCadastreNumber(cadastre);
        p.setTitle(title);
        p.setDistrict(district);
        p.setVillage(village);
        p.setLatitude(lat);
        p.setLongitude(lng);
        p.setAreaHa(area);
        p.setActivityType(activity);
        p.setSoilType(soil);
        p.setNitrogen(sc[0]);
        p.setPhosphorus(sc[1]);
        p.setPotassium(sc[2]);
        p.setAvgTemperature(sc[3]);
        p.setHumidity(sc[4]);
        p.setPh(sc[5]);
        p.setRainfall(sc[6]);
        p.setWaterSourceKm(waterKm);
        p.setRoadKm(roadKm);
        p.setIrrigationAvailable(irrigation);
        p.setElectricityAvailable(electricity);
        p.setMineClearance(mine);
        p.setMineClearanceDate(mineDate == null ? null : LocalDate.parse(mineDate));
        p.setLeaseYears(lease);
        p.setMinInvestment(minInvestment);
        p.setUsageTerms("Torpaq " + lease + " il müddətinə icarəyə verilir. Təyinatı dəyişdirilə bilməz. "
                + "İlk 2 il ərzində investisiyanın ən azı 50%-i reallaşdırılmalıdır. Minadan təmizlənmə sertifikatı ANAMA tərəfindən verilir.");
        p.setDescription(description);
        applyRealPlot(p, district, activity);
        return plots.save(p);
    }

    // ---------------------------------------------------------------- real geometry from official open data

    private record RealPlot(String district, String village, String ref, double areaHa, String clearedFrom, String clearedAt,
                            double lat, double lng, com.fasterxml.jackson.databind.JsonNode boundary) {
    }

    private final java.util.Map<String, java.util.Deque<RealPlot>> realPlots = new java.util.HashMap<>();
    private final java.util.Map<String, Integer> codeSeq = new java.util.HashMap<>();
    /** How much a plot grew when its real area replaced the illustrative one; seeded applications scale with it. */
    private final java.util.Map<LandPlot, Double> investmentScale = new java.util.IdentityHashMap<>();

    private static final java.util.Map<String, String> CODE = java.util.Map.of(
            "Ağdam", "AGD", "Füzuli", "FZL", "Xocavənd", "XCV", "Xocalı", "XCL", "Şuşa", "SHS", "Tərtər", "TRT");

    private static final java.util.Map<ActivityType, String> NOUN = java.util.Map.of(
            ActivityType.CROP_FARMING, "əkinçilik sahəsi", ActivityType.LIVESTOCK, "heyvandarlıq sahəsi",
            ActivityType.HORTICULTURE, "meyvə bağı sahəsi", ActivityType.VITICULTURE, "üzümçülük sahəsi",
            ActivityType.GREENHOUSE, "istixana sahəsi", ActivityType.BEEKEEPING, "arıçılıq sahəsi");

    /**
     * Replaces location, boundary, area and clearance with a real certified area (ANAMA, requested by the Ministry
     * of Agriculture). Soil indicators, infrastructure distances and investment terms stay illustrative.
     */
    private void applyRealPlot(LandPlot p, String district, ActivityType activity) {
        if (realPlots.isEmpty()) loadRealPlots();
        RealPlot r = java.util.Optional.ofNullable(realPlots.get(district)).map(java.util.Deque::poll).orElse(null);
        if (r == null) return;
        double perHa = p.getMinInvestment() / Math.max(1, p.getAreaHa());
        int seq = codeSeq.merge(r.district(), 1, Integer::sum);
        p.setCode("QR-" + CODE.getOrDefault(r.district(), "KRB") + "-" + String.format("%03d", seq));
        p.setCadastreNumber(null);
        p.setDistrict(r.district());
        p.setVillage(r.village());
        p.setTitle(r.village() + " " + NOUN.get(activity));
        p.setLatitude(r.lat());
        p.setLongitude(r.lng());
        p.setAreaHa(r.areaHa());
        long oldMin = p.getMinInvestment();
        p.setMinInvestment(Math.round(perHa * r.areaHa() / 10_000) * 10_000);
        investmentScale.put(p, oldMin == 0 ? 1.0 : (double) p.getMinInvestment() / oldMin);
        p.setMineClearance(MineClearanceStatus.CLEARED);
        p.setClearanceStartDate(r.clearedFrom() == null ? null : LocalDate.parse(r.clearedFrom()));
        p.setMineClearanceDate(r.clearedAt() == null ? null : LocalDate.parse(r.clearedAt()));
        p.setAnamaRef(r.ref());
        p.setBoundaryGeoJson(r.boundary().toString());
        p.setDataSource("Sərhəd, sahə və təmizlənmə tarixi: ANAMA, opendata.az (ODC-BY). Sifarişçi: Kənd Təsərrüfatı Nazirliyi.");
        p.setDescription("Minadan təmizlənmiş və sertifikatlaşdırılmış sahə (ANAMA " + r.ref() + "). "
                + p.getActivityType().getLabel() + " üçün təklif olunur.");
    }

    private void loadRealPlots() {
        try (var in = new org.springframework.core.io.ClassPathResource("opendata/plots.json").getInputStream()) {
            var arr = new com.fasterxml.jackson.databind.ObjectMapper().readTree(in);
            for (var n : arr) {
                RealPlot r = new RealPlot(n.get("district").asText(), n.get("village").asText(), n.get("ref").asText(),
                        n.get("areaHa").asDouble(), n.path("clearedFrom").asText(null), n.path("clearedAt").asText(null),
                        n.get("lat").asDouble(), n.get("lng").asDouble(), n.get("boundary"));
                realPlots.computeIfAbsent(r.district(), k -> new java.util.ArrayDeque<>()).add(r);
            }
            log.info("Loaded {} real plot boundaries from opendata/plots.json", arr.size());
        } catch (java.io.IOException e) {
            log.warn("opendata/plots.json not available, plots keep illustrative locations", e);
        }
    }

    private Competition competition(String code, String title, String description, String requirements, LocalDate start,
                                     LocalDate deadline, CompetitionStatus status, AppUser creator, AppUser approver, LandPlot... included) {
        Competition c = new Competition();
        c.setCode(code);
        c.setTitle(title);
        c.setDescription(description);
        c.setRequirements(requirements);
        c.setStartDate(start);
        c.setDeadline(deadline);
        c.setStatus(status);
        c.setCreatedBy(creator);
        if (approver != null) {
            c.setApprovedBy(approver);
            c.setApprovedAt(Instant.now().minus(Duration.ofDays(Math.max(1, java.time.temporal.ChronoUnit.DAYS.between(start, LocalDate.now())))));
        }
        c.getPlots().addAll(Arrays.asList(included));
        if (status == CompetitionStatus.PUBLISHED) {
            for (LandPlot p : included) p.setStatus(PlotStatus.IN_COMPETITION);
        }
        return competitions.save(c);
    }

    private InvestmentApplication application(AppUser who, Competition c, LandPlot plot, ApplicantType type, String crop, long investment,
                             int ownFunds, int jobs, int months, int experience, ApplicationStatus status, EktisSyncStatus ektis,
                             Instant createdAt, AppUser reviewer, String note) {
        InvestmentApplication a = new InvestmentApplication();
        a.setApplicant(who);
        a.setCompetition(c);
        a.setPlot(plot);
        a.setApplicantType(type);
        a.setApplicantName(who.getFullName());
        a.setTaxId(who.getTaxId());
        a.setPhone(who.getPhone());
        a.setEmail(who.getEmail());
        a.setAddress(type == ApplicantType.COMPANY ? "Bakı ş., Nəsimi r., 28 May küç. 12" : "Bakı ş., Yasamal r.");
        a.setActivityType(plot.getActivityType());
        a.setPlannedCrop(crop);
        a.setPlannedInvestment(Math.round(investment * investmentScale.getOrDefault(plot, 1.0) / 1000) * 1000);
        a.setOwnFundsPercent(ownFunds);
        a.setJobsCreated(jobs);
        a.setReturneeJobs(jobs * (int) (Math.abs(plot.getCode().hashCode()) % 7 + 2) / 10);
        a.setProjectMonths(months);
        a.setExperienceYears(experience);
        a.setBusinessPlan("Layihənin məqsədi " + plot.getDistrict() + " rayonunda " + plot.getAreaHa() + " ha sahədə müasir "
                + plot.getActivityType().getLabel().toLowerCase(Locale.ROOT) + " təsərrüfatının yaradılmasıdır. "
                + "Birinci il: torpağın hazırlanması, damcı suvarma sisteminin qurulması və texnikanın alınması. "
                + "İkinci il: tam istehsal gücünə çıxış. Məhsulun 60%-i daxili bazara, 40%-i ixraca yönəldiləcək. "
                + "Yerli sakinlərdən " + jobs + " nəfər daimi işlə təmin olunacaq.");
        a.setStatus(status);
        a.setEktisStatus(ektis);
        a.setEktisReference(ektis == EktisSyncStatus.NOT_SENT ? null : "EKTIS-APP-" + createdAt.atZone(java.time.ZoneId.systemDefault()).getYear() + "-" + (500 + applications.count()));
        a.setCreatedAt(createdAt);
        if (status.isFinal()) a.setDecisionNote(note);

        FileStorageService.StoredFile plan = files.storeBytes("biznes-plan.pdf", pdf("Biznes plan - " + plot.getCode()));
        a.addDocument(new ApplicationDocument(DocumentType.BUSINESS_PLAN, plan.originalName(), plan.storedName(), plan.contentType(), plan.size()));
        FileStorageService.StoredFile id = files.storeBytes("sexsiyyet-vesiqesi.pdf", pdf("Sexsiyyet vesiqesi (demo)"));
        a.addDocument(new ApplicationDocument(DocumentType.ID_DOCUMENT, id.originalName(), id.storedName(), id.contentType(), id.size()));
        if (type == ApplicantType.COMPANY) {
            FileStorageService.StoredFile reg = files.storeBytes("qeydiyyat-sehadetnamesi.pdf", pdf("Dovlet qeydiyyati sehadetnamesi (demo)"));
            a.addDocument(new ApplicationDocument(DocumentType.REGISTRATION_CERT, reg.originalName(), reg.storedName(), reg.contentType(), reg.size()));
        }

        history(a, null, ApplicationStatus.SUBMITTED, "Müraciət elektron qaydada qəbul edildi", who.getFullName(), createdAt);
        history(a, ApplicationStatus.SUBMITTED, ApplicationStatus.SUBMITTED, "EKTİS: Fermer reyestrində təsdiqləndi", "EKTİS",
                createdAt.plusSeconds(5));
        Instant t = createdAt.plus(Duration.ofDays(1));
        if (status != ApplicationStatus.SUBMITTED && reviewer != null) {
            history(a, ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, null, reviewer.getFullName(), t);
            if (status == ApplicationStatus.INFO_REQUESTED) {
                history(a, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.INFO_REQUESTED, note, reviewer.getFullName(), t.plus(Duration.ofDays(2)));
            } else if (status.isFinal()) {
                history(a, ApplicationStatus.UNDER_REVIEW, status, note, reviewer.getFullName(), t.plus(Duration.ofDays(10)));
                if (status == ApplicationStatus.APPROVED) plot.setStatus(PlotStatus.ASSIGNED);
            }
        }
        a.setAutoScore(scorer.score(a).total());
        applications.save(a);
        a.setApplicationNumber(String.format("QIM-%d-%06d", createdAt.atZone(java.time.ZoneId.systemDefault()).getYear(), a.getId()));
        if (status == ApplicationStatus.INFO_REQUESTED) {
            notifications.notify(who, "Əlavə məlumat tələb olunur: " + a.getApplicationNumber(), note, "/kabinet/" + a.getId());
        }
        return a;
    }

    private void score(InvestmentApplication a, AppUser evaluator, int f, int fin, int soc, int tech, String comment) {
        EvaluatorScore s = new EvaluatorScore(a, evaluator);
        s.update(f, fin, soc, tech, comment);
        scores.save(s);
    }

    private static void history(InvestmentApplication a, ApplicationStatus from, ApplicationStatus to, String comment, String by, Instant at) {
        StatusChange s = new StatusChange(from, to, comment, by);
        s.setChangedAt(at);
        a.addHistory(s);
    }

    /** A small generated "field photo" (PNG) for the seeded milestone report. */
    private static byte[] fieldPhoto() {
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(640, 400, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = img.createGraphics();
        g.setPaint(new java.awt.GradientPaint(0, 0, new java.awt.Color(150, 190, 225), 0, 180, new java.awt.Color(215, 230, 240)));
        g.fillRect(0, 0, 640, 180);
        g.setColor(new java.awt.Color(92, 70, 50));
        g.fillRect(0, 180, 640, 220);
        g.setColor(new java.awt.Color(60, 140, 70));
        for (int row = 0; row < 7; row++) for (int x = 20; x < 640; x += 46) g.fillOval(x + row * 6, 200 + row * 28, 14, 14);
        g.dispose();
        try (var out = new ByteArrayOutputStream()) {
            javax.imageio.ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Minimal valid single-page PDF with one line of ASCII text. */
    static byte[] pdf(String text) {
        String safe = text.replaceAll("[^\\x20-\\x7E]", "").replace("(", "[").replace(")", "]");
        String stream = "BT /F1 18 Tf 72 720 Td (" + safe + ") Tj ET";
        String[] objects = {
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
                "<< /Length " + stream.length() + " >>\nstream\n" + stream + "\nendstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"};
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        List<Integer> offsets = new ArrayList<>();
        write(out, "%PDF-1.4\n");
        for (int i = 0; i < objects.length; i++) {
            offsets.add(out.size());
            write(out, (i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n");
        }
        int xref = out.size();
        StringBuilder sb = new StringBuilder("xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n");
        for (int off : offsets) sb.append(String.format("%010d 00000 n \n", off));
        sb.append("trailer\n<< /Size ").append(objects.length + 1).append(" /Root 1 0 R >>\nstartxref\n").append(xref).append("\n%%EOF\n");
        write(out, sb.toString());
        return out.toByteArray();
    }

    private static void write(ByteArrayOutputStream out, String s) {
        out.writeBytes(s.getBytes(StandardCharsets.US_ASCII));
    }
}
