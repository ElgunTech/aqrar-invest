# Aqrar İnvest — İşğaldan azad edilmiş ərazilər üçün investisiya müsabiqəsi portalı

Qarabağ iqtisadi rayonunda kənd təsərrüfatı sahələrinə investisiya müsabiqəsini rəqəmsallaşdıran,
EKTİS-ə inteqrasiyaya hazır işlək prototip.

[![CI](https://github.com/ElgunTech/aqrar-invest/actions/workflows/ci.yml/badge.svg)](https://github.com/ElgunTech/aqrar-invest/actions/workflows/ci.yml)

**Canlı versiya:** https://aqrar-invest.vercel.app (backend: https://aqrar-invest-api.onrender.com, Swagger: `/swagger-ui.html`)

| Komponent | Texnologiya |
|---|---|
| Backend | Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA, H2 (demo) / PostgreSQL |
| Frontend | React 18, TypeScript, Vite, React Router, Leaflet, MapLibre GL (3D), Recharts; AZ / EN / RU interfeys |
| AI | scikit-learn RandomForest (Kaggle-da öyrədilib) → ONNX → Java-da ONNX Runtime |
| API sənədləri | OpenAPI 3 / Swagger UI |
| Xarici açıq xidmətlər | Sentinel-2 (Microsoft Planetary Computer), PVGIS (Avropa Komissiyası JRC), AWS Terrain Tiles, Esri World Imagery |
| Yerləşdirmə | Vercel (frontend) + Render (Docker, backend); GitHub-a push → hər ikisi avtomatik yenilənir |

## Sənədlər

* **[Qiymətləndirmə meyarları və sübutlar](docs/QIYMETLENDIRME.md)**: təhvil paketinin hər bəndi və hər meyar üçün portalda harada göstərildiyi
* [Arxitektura və ER diaqramı](docs/ARXITEKTURA.md)
* [EKTİS və myGov inteqrasiyası, API nümunələri](docs/INTEQRASIYA.md)
* [Texniki yol xəritəsi](docs/YOL-XERITESI.md)

## Demo hesablar

Bütün demo hesabların şifrəsi: `Demo12345`

| Rol | E-poçt | Nə edə bilər |
|---|---|---|
| Administrator | `admin@demo.az` | Hər şey + müsabiqəni təsdiq etmək, audit jurnalı, AI modelini yenidən yükləmək |
| Qiymətləndirici | `valuator@demo.aza` | Müraciətlərə baxış, status dəyişmək, sahə və müsabiqə yaratmaq |
| Sahibkar | `investor@demo.aze` | Müraciət etmək, statusu izləmək (FİN `5ZK7QWE` EKTİS reyestrində var) |
| Sahibkar (şirkət) | `aqro@demo.az` | VÖEN `1402567891` |
| Sahibkar | `leyla@demo.az` | "Əlavə məlumat tələb olunur" statusunda müraciəti var |

Demo məlumatlar boş baza ilə ilk başlanğıcda avtomatik yaradılır (`app.seed-demo-data=true`).
Bazanı sıfırlamaq üçün `backend/data` və `backend/uploads` qovluqlarını silib serveri yenidən başladın.

## İşə salma

### 1. Backend (port 8080)

JDK 17+ lazımdır (bu kompüterdə JetBrains Rider-in JBR 21-i istifadə olunur).

```bash
cd backend
mvn spring-boot:run
```

Maven quraşdırılmayıbsa layihədəki nüsxə: `../.tools/apache-maven-3.9.9/bin/mvn`.

### 2. Frontend — inkişaf rejimi (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Vite `/api` sorğularını avtomatik 8080-ə yönləndirir.

### Ən sadə yol (Windows)

```bat
build.bat
start.bat
```

`start.bat reset` demo məlumatlarını ilkin vəziyyətə qaytarır (hər demo məşqindən sonra).

### 3. İstehsal rejimi (tək JAR)

```bash
cd frontend && npm run build      # nəticə backend/src/main/resources/static-ə yazılır
cd ../backend && mvn package
java -jar target/agro-portal.jar
```

PostgreSQL ilə: `DATABASE_URL=postgresql://user:parol@host/db?sslmode=require` (Neon, Render və s. formatı; avtomatik PostgreSQL-ə keçir) və ya `--spring.profiles.active=postgres` ilə `DB_URL`, `DB_USER`, `DB_PASSWORD`.

### 4. Docker ilə (frontend + backend bir imicdə)

```bash
docker build -t aqrar-invest .
docker run -p 8080:8080 aqrar-invest            # http://localhost:8080
```

İstəyə bağlı mühit dəyişənləri: `DATABASE_URL`, `BREVO_API_KEY` + `MAIL_FROM` (e-poçt), `GROQ_API_KEY` (chatbot üçün LLM).

## myGov ilə giriş

* OAuth 2.0 authorization code axını: `GET /api/v1/auth/mygov/start` (state sessiyada) → provayderin razılıq ekranı →
  `/mygov/callback` → `POST /api/v1/auth/mygov/callback` (state yoxlanılır, kod serverdə tokenə dəyişdirilir).
* FİN ilə hesab tapılır, yoxdursa avtomatik yaradılır. FİN və telefon müraciət formasına özü dolur.
* Demo versiyada provayder **simulyasiyadır** (`/mygov-demo`, `/mock-mygov/api`), real brend istifadə olunmur.
  Real myGov-a keçid üçün yalnız `app.mygov.*` konfiqurasiyası dəyişir (`MyGovClient` interfeysi).
* Demo vətəndaşlar: Rəşad Məmmədov və Leyla Hüseynova (mövcud hesablara daxil olur), Kamran Həsənov və Günay Quliyeva (yeni hesab yaranır).

## AI modeli

* Notebook: [`ml/crop_recommendation.ipynb`](ml/crop_recommendation.ipynb) (Kaggle: `atharvaingle/crop-recommendation-dataset`).
* 6 alqoritm müqayisə edilib, RandomForest seçilib: **test dəqiqliyi 99.5%, 5-fold CV 99.4%**.
* Model `backend/model/crop_model.onnx` + `model_meta.json` olaraq Java prosesinin içində işləyir. Python server yoxdur.
* Regional iqlim filtri tropik bitkiləri (banan, manqo, kokos...) nəticədən çıxarır və bunu istifadəçiyə açıq deyir.
* Model faylı yoxdursa, portal şəffaf "fallback" alqoritmlə işləməyə davam edir.
* Yeni model: faylları `backend/model/`-a qoyun → Admin panel → "EKTİS və AI" → "Modeli yenidən yüklə".

## EKTİS inteqrasiyası

* `EktisClient` interfeysi + `HttpEktisClient` (HTTP/JSON, `X-API-Key`). Real EKTİS-ə keçid = `app.ektis.base-url` dəyişmək.
* **Transactional outbox**: hadisələr biznes dəyişikliyi ilə eyni tranzaksiyada yazılır, fon prosesi təkrar cəhdlərlə çatdırır.
* **Mock EKTİS** (`/mock-ektis/api/v1`) ayrıca sistem kimi davranır: müraciəti qeydə alır və 3 saniyə sonra
  portalın webhook-una (`/api/v1/integration/ektis/events`) fermer reyestri yoxlamasının nəticəsini göndərir.
* Demo: Admin → "EKTİS və AI" → "EKTİS-i söndür" → müraciət göndər → hadisə növbədə gözləyir → "Bərpa et" → avtomatik çatdırılır.

## Rəsmi açıq məlumatlar

Portal demo deyil, rəsmi mənbələrdən istifadə edir (`tools/opendata/fetch.mjs` ilə yenidən yüklənir):

| Məlumat | Mənbə | Lisenziya | İstifadə |
|---|---|---|---|
| Minadan təmizlənmiş və sertifikatlaşdırılmış sahələrin sərhədləri (2020–2026) | ANAMA, opendata.az | ODC-BY | Müsabiqə sahələrinin real sərhədi, sahəsi, kəndi və təmizlənmə tarixi; xəritədə 1019 k/t sahəsi |
| Rayonlar üzrə məhsuldarlıq və istehsal (2000–2025, 12 göstərici) | Dövlət Statistika Komitəsi (azstat.gov.az API) | CC0 | Sahə səhifəsində rayon statistikası, kalkulyatorda rəsmi məhsuldarlıq, köməkçinin cavabları |
| Sentinel-2 L2A peyk görüntüləri (aylıq, son 13 ay) | Copernicus / ESA, Microsoft Planetary Computer | Copernicus açıq lisenziyası | Sahənin sərhədi üzrə NDVI, öhdəliklərin peyk monitorinqi |
| Gündəlik temperatur və yağıntı (2015–2024) | ERA5 (ECMWF / Copernicus), Open-Meteo | CC BY 4.0 | Sahənin iqlim riski və bitkilər üçün risk qiymətləndirməsi |
| Günəş radiasiyası və PV istehsalı | PVGIS 5.3, Avropa Komissiyası JRC | açıq | Sahənin günəş paneli üçün uyğunluğu və istehsal potensialı |
| Elektrik enerjisi tarifləri | Tarif (Qiymət) Şurası, 29.12.2024 tarixli 19 nömrəli qərar | rəsmi | Günəşdən alış tarifi 8.5 qəpik/kWh, kənd təsərrüfatı tarifi 10.6 qəpik/kWh |

Nümunəvi qalanlar (açıq mənbədə yoxdur): sahələrin torpaq analizləri (N, P, K, pH), suya və yola məsafə, investisiya şərtləri, müraciətçilər.
Admin paneldən statistikanı azstat API-dən canlı yeniləmək olar.

## Köməkçi (chatbot)

Sağ aşağıdakı "Köməkçi" düyməsi. Cavablar portalın bazasından, rəsmi statistikadan, ANAMA qatından və AI modelindən götürülür və mənbə ilə göstərilir. Açar tələb etmir.
İstəyə bağlı: pulsuz Groq API açarı ilə ([console.groq.com](https://console.groq.com)) cavablar LLM ilə təbii dildə yazılır, yenə yalnız tapılmış faktlar əsasında:

```bat
set GROQ_API_KEY=gsk_...
start.bat
```

## Fərqləndirici modullar

* **Öhdəliklərin monitorinqi:** müraciət təsdiqlənəndə investor üçün 4 mərhələli öhdəlik planı yaranır (6/12/24/36 ay, investisiyanın 20/50/80/100%-i). Hesabat GPS-li foto ilə verilir, koordinat sahənin sərhədi ilə yoxlanılır. Nazirlik panelində svetofor: vaxtında, diqqət, gecikir.
* **İnternetsiz foto-hesabat:** sahədə siqnal olmayanda portal keşdən açılır (service worker), hesabat və foto cihazda (IndexedDB) saxlanılır və bağlantı yarananda özü göndərilir; hər hesabatın statusu görünür: «gözləyir», «göndərilir», «göndərildi», «xəta». Fotoda GPS yoxdursa, cihazın GPS-i (internetsiz işləyir) götürülür. Şəxsi keş çıxışda silinir.
* **Dürüstlük siqnalları:** başqa müraciətçi ilə eyni telefon/e-poçt, kopyalanmış biznes plan (mətn oxşarlığı), real olmayan investisiya, FİN uyğunsuzluğu, qiymətləndiricinin özü ilə maraqlar toqquşması. Siqnallar qərar vermir, komissiyanın diqqətini çəkir; sahibkar onları görmür.
* **Böyük Qayıdış:** qayıdan sakinlər üçün yaradılan iş yerləri ayrıca qiymətləndirmə meyarı və statistika göstəricisidir.
* **Komissiya:** ən azı 2 üzvün müstəqil balı, maraqlar toqquşması bəyannaməsi.
* **Kor qiymətləndirmə:** komissiya üzvü bal verənə qədər müraciətçinin adını, FİN/VÖEN-ini, əlaqə məlumatlarını və şəxsiyyət sənədlərini görmür; yalnız biznes planı, rəqəmlər və dürüstlük siqnalları açıqdır. Ad öz balını verdikdən sonra açılır.
* **Dəyişdirilə bilməyən qərar jurnalı:** hər status dəyişikliyi və komissiya balı SHA-256 hash zəncirinə möhürlənir. `/yoxla` səhifəsi zəncirin bütövlüyünü və müraciətin cari qeydlərinin möhürlənmiş vəziyyətlə uyğunluğunu ictimaiyyətə göstərir. Demo: admin → müraciət → "Saxtakarlığı simulyasiya et" (bazada birbaşa dəyişiklik) → yoxlama qırmızı olur; təkrar basanda bərpa.
* **Açıq məlumat (OCDS 1.1):** müsabiqələr, sahələr, iştirakçılar və qaliblər Open Contracting Data Standard formatında (`/api/v1/public/open-data/ocds`), rəsmi OCDS 1.1.5 JSON sxeminə uyğunluğu yoxlanılıb. Fiziki şəxslərin adları açıqlanmır.
* **QR qəbz və qərar sənədi:** müraciət qəbzi və komissiyanın qərarı (QR kod, komissiya balları, elektron imza, möhür) çap və PDF üçün; ictimai yoxlama səhifəsi `/yoxla`.
* **Peyk monitorinqi (NDVI):** hər sahə üçün son 13 ayın ən az buludlu Sentinel-2 görüntüsü, NDVI sahənin rəsmi sərhədi üzrə hesablanır. Yazda bütün boş sahələr yağışdan yaşıllaşır, ona görə əkin yay aylarındakı (iyun–sentyabr) NDVI və ötən ilin həmin ayı ilə müqayisə ilə müəyyən edilir. Qərardan 6 ay sonra əkin görünmürsə, qırmızı xəbərdarlıq yaranır. Investorun foto-hesabatından asılı olmayan ikinci yoxlama.
* **Günəş enerjisi:** sahənin günəş paneli üçün uyğunluğu (100 bal: PVGIS potensialı, minatəmizləmə, şəbəkə, fəaliyyətlə uyğunluq). İki ssenari: «aktiv istehlakçı» (150 kW-a qədər, öz ehtiyacı 10.6 qəpik qənaət, artığı Azərişıq şəbəkəsinə 8.5 qəpik) və aqrovoltaik stansiya (panellər altında əkin davam edir). Sahənin illik gəlirinə təsiri, geri qaytarılma, CO₂. Xərclər redaktə edilə bilən fərziyyələrdir.
* **İqlim riski:** sahənin koordinatları üzrə 10 illik (2015–2024) ERA5 gündəlik məlumatı (Open-Meteo, açarsız): şaxtalı günlər, gec yaz şaxtası, ən soyuq gecə, isti günlər, yağıntı, istilik cəmi. AI-nin tövsiyə etdiyi bitkilər üçün qış şaxtası, gec yaz şaxtası, istilik stresi və suvarma ehtiyacı riski (aşağı / orta / yüksək).
* **Sahə pasportu (PDF):** `/sahe/{id}/pasport` — minatəmizləmə, AI, iqlim riski, peyk, günəş və rəsmi statistika bir A4 sənəddə, QR kodla; investor banka və tərəfdaşa təqdim edə bilər.
* **3D xəritə:** relyef, peyk görüntüsü, ANAMA qatı və sahələr; sahə seçiləndə kamera ona uçur. Sahə səhifəsində "3D bax".
* **E-poçt bildirişləri:** qeydiyyat, müraciət, status dəyişikliyi, EKTİS təsdiqi və monitorinq nəticəsi istifadəçinin e-poçtuna göndərilir (Brevo HTTP API; SMTP də dəstəklənir). Demo hesablarına (`@demo.*`) göndərilmir.
* **Üç dil:** AZ / EN / RU (yuxarı zolaqda). Rəsmi mənbələrdən gələn adlar azərbaycanca qalır.

Demo:
* `valuator@demo.aza` → İnzibati panel → "Öhdəliklərin monitorinqi": pilot qalib (Seyidmahmudlu, 14 ay əvvəl) qırmızıdır, həm gecikmiş mərhələyə, həm də peykə görə: "Torpaq verildi, amma 14 aydır əkin görünmür" (real Sentinel-2 məlumatı).
* Müraciətlər → "Elçin Qurbanov" (6 siqnal).
* Sahə səhifəsi → "Günəş enerjisi" tabı, məsələn `/sahe/1?tab=gunes`.

## Təhlükəsizlik

* Rollar: `INVESTOR`, `EVALUATOR`, `ADMIN`; URL və servis səviyyəsində yoxlama.
* BCrypt şifrələr, sessiya fiksasiyasından qorunma, HttpOnly + SameSite=Strict cookie, CSRF token (XSRF-TOKEN cookie → X-XSRF-TOKEN başlığı).
* FİN/VÖEN, telefon və ünvan bazada AES-256-GCM ilə şifrələnir (`PII_KEY`); FİN üzrə axtarış HMAC «kor indeks» ilə. Köhnə açıq qeydləri işə düşəndə miqrasiya şifrələyir.
* «Saxtakarlığı simulyasiya et» yalnız `DEMO_TAMPER=true` ilə açılır (standart: söndürülüb) və «DEMO» kimi işarələnir.
* 5 uğursuz girişdən sonra 10 dəqiqəlik blok.
* Müsabiqə üçün "dörd göz" prinsipi: yaradan şəxs təsdiq edə bilməz.
* Fayllar: ölçü limiti (5 MB), uzantı + məzmun imzası (magic bytes) yoxlaması, təsadüfi adla web root-dan kənarda saxlanma.
* Siyahılarda FİN/VÖEN maskalanır; tam baxış və sənəd yükləmə audit jurnalına yazılır.
* CSV hesabatında formula injection qorunması.
* Sistemlərarası API-lər `X-API-Key` ilə (sabit vaxtlı müqayisə).
* Sorğu limiti (hər müştəri üçün, dəqiqədə): giriş və qeydiyyat 10, köməkçi 20, peyk/günəş 40, qalan API 300; aşanda HTTP 429.
* Frontend başlıqları (`frontend/vercel.json`): Content-Security-Policy (yalnız lazım olan mənbələr; production build-də 8 səhifədə pozuntu yoxdur), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP.
* CI: hər push-da backend testləri və frontend tip yoxlaması + build (GitHub Actions).

## Yerləşdirmə

| Hissə | Harada | Konfiqurasiya |
|---|---|---|
| Frontend | Vercel, Root Directory `frontend` | `frontend/vercel.json`: `/api`, `/mock-mygov`, Swagger sorğuları Render-ə ötürülür (eyni domen, cookie işləyir) |
| Backend | Render, Docker, pulsuz plan | `Dockerfile`, `render.yaml` |
| Oyaq saxlama | GitHub Actions, hər 10 dəqiqə | `.github/workflows/keep-awake.yml` |

Render mühit dəyişənləri: `PII_KEY` (32 bayt, base64; şəxsi məlumatların şifrələmə açarı; təyin ediləndə köhnə inkişaf açarı ilə yazılmış qeydləri miqrasiya avtomatik yenidən şifrələyir), `INTEGRATION_API_KEY`, `EKTIS_API_KEY`, `MYGOV_CLIENT_SECRET` (təyin edilmədikdə hər işə düşmədə təsadüfi dəyər yaranır, demo dəyərlər istifadə olunmur), `DEMO_TAMPER=true` (yalnız nümayiş üçün; saxtakarlıq düyməsi yalnız ADMIN üçündür), istəyə bağlı: `BREVO_API_KEY` və `MAIL_FROM` (e-poçt), `SMTP_USER` / `SMTP_PASSWORD` (SMTP alternativi, Render-in pulsuz planında SMTP portları bağlıdır), `GROQ_API_KEY` (chatbot üçün LLM).
Hansı kanalların açıq olduğunu `/api/v1/public/status` göstərir. Render hər deploy-da demo bazanı yenidən yaradır.

## Struktur

```
backend/   Spring Boot (domain, repo, service, web, security, integration, ai, config)
frontend/  React + Vite (pages, components, lib); public/world — açıq lisenziyalı fotolar
ml/        Kaggle notebook (öyrətmə + ONNX eksportu)
```

Foto mənbələri və lisenziyalar: saytda `/haqqinda` səhifəsi.
