# Aqrar İnvest — İşğaldan azad edilmiş ərazilər üçün investisiya müsabiqəsi portalı

Qarabağ iqtisadi rayonunda kənd təsərrüfatı sahələrinə investisiya müsabiqəsini rəqəmsallaşdıran,
EKTİS-ə inteqrasiyaya hazır işlək prototip.

| Komponent | Texnologiya |
|---|---|
| Backend | Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA, H2 (demo) / PostgreSQL |
| Frontend | React 18, TypeScript, Vite, React Router, Leaflet, Recharts |
| AI | scikit-learn RandomForest (Kaggle-da öyrədilib) → ONNX → Java-da ONNX Runtime |
| API sənədləri | OpenAPI 3 / Swagger UI |

## Sənədlər

* [Arxitektura və ER diaqramı](docs/ARXITEKTURA.md)
* [EKTİS və myGov inteqrasiyası, API nümunələri](docs/INTEQRASIYA.md)
* [Texniki yol xəritəsi](docs/YOL-XERITESI.md)

## Demo hesablar

Bütün demo hesabların şifrəsi: `Demo12345`

| Rol | E-poçt | Nə edə bilər |
|---|---|---|
| Administrator | `admin@demo.az` | Hər şey + müsabiqəni təsdiq etmək, audit jurnalı, AI modelini yenidən yükləmək |
| Qiymətləndirici | `evaluator@demo.az` | Müraciətlərə baxış, status dəyişmək, sahə və müsabiqə yaratmaq |
| Sahibkar | `investor@demo.az` | Müraciət etmək, statusu izləmək (FİN `5ZK7QWE` EKTİS reyestrində var) |
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

PostgreSQL ilə: `--spring.profiles.active=postgres` və `DB_URL`, `DB_USER`, `DB_PASSWORD` mühit dəyişənləri.

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

## Fərqləndirici modullar

* **Öhdəliklərin monitorinqi:** müraciət təsdiqlənəndə investor üçün 4 mərhələli öhdəlik planı yaranır (6/12/24/36 ay, investisiyanın 20/50/80/100%-i). Hesabat GPS-li foto ilə verilir, koordinat sahənin sərhədi ilə yoxlanılır. Nazirlik panelində svetofor: vaxtında, diqqət, gecikir.
* **Dürüstlük siqnalları:** başqa müraciətçi ilə eyni telefon/e-poçt, kopyalanmış biznes plan (mətn oxşarlığı), real olmayan investisiya, FİN uyğunsuzluğu, qiymətləndiricinin özü ilə maraqlar toqquşması. Siqnallar qərar vermir, komissiyanın diqqətini çəkir; sahibkar onları görmür.
* **Böyük Qayıdış:** qayıdan sakinlər üçün yaradılan iş yerləri ayrıca qiymətləndirmə meyarı və statistika göstəricisidir.
* **Komissiya:** ən azı 2 üzvün müstəqil balı, maraqlar toqquşması bəyannaməsi.
* **QR qəbz:** ictimai yoxlama səhifəsi `/yoxla`.

Demo: `evaluator@demo.az` → İnzibati panel → "Öhdəliklərin monitorinqi" (qırmızı layihə) və Müraciətlər → "Elçin Babayev" (6 siqnal).

## Təhlükəsizlik

* Rollar: `INVESTOR`, `EVALUATOR`, `ADMIN`; URL və servis səviyyəsində yoxlama.
* BCrypt şifrələr, sessiya fiksasiyasından qorunma, HttpOnly + SameSite=Strict cookie.
* 5 uğursuz girişdən sonra 10 dəqiqəlik blok.
* Müsabiqə üçün "dörd göz" prinsipi: yaradan şəxs təsdiq edə bilməz.
* Fayllar: ölçü limiti (5 MB), uzantı + məzmun imzası (magic bytes) yoxlaması, təsadüfi adla web root-dan kənarda saxlanma.
* Siyahılarda FİN/VÖEN maskalanır; tam baxış və sənəd yükləmə audit jurnalına yazılır.
* CSV hesabatında formula injection qorunması.
* Sistemlərarası API-lər `X-API-Key` ilə (sabit vaxtlı müqayisə).

## Struktur

```
backend/   Spring Boot (domain, repo, service, web, security, integration, ai, config)
frontend/  React + Vite (pages, components, lib); public/world — açıq lisenziyalı fotolar
ml/        Kaggle notebook (öyrətmə + ONNX eksportu)
```

Foto mənbələri və lisenziyalar: saytda `/haqqinda` səhifəsi.
