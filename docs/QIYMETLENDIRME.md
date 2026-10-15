# Qiymətləndirmə meyarları və sübutlar

Canlı portal: **https://aqrar-invest.vercel.app** · Mənbə kodu: bu repozitoriya · Bələdçi tur videosu: `video/` (2:50)

## Minimum təhvil paketi

| Tələb | Harada | Necə yoxlamaq olar |
|---|---|---|
| İşlək portal prototipi | Vercel (frontend) + Render (Spring Boot) + Neon (PostgreSQL) | Canlı link; `/api/v1/public/status` → `"database": "PostgreSQL"` |
| Sahələrin kataloqu və axtarış | `/kataloq`, `/xerite`, `/xerite-3d`, ana səhifədə axtarış | Rayon, fəaliyyət, minatəmizləmə, sahə, AI bitkisi, açıq müsabiqə filtrləri; sıralama; 2–4 sahənin müqayisəsi |
| Elektron müraciət və status | `/muraciet` (5 addım), `/kabinet` | Qəbz (QR), status axını, tarixçə, bildiriş və e-poçt, qərar sənədi |
| İnzibati panel | `/admin` | Müraciətlər, komissiya, müsabiqələr (dörd göz), sahələr, monitorinq, EKTİS, audit jurnalı |
| Məlumat bazasının strukturu | [ARXITEKTURA.md](ARXITEKTURA.md) → ER diaqramı (13 cədvəl) | JPA entity-ləri `backend/.../domain` |
| API və inteqrasiya konsepsiyası | [INTEQRASIYA.md](INTEQRASIYA.md), Swagger `/swagger-ui.html` | EKTİS outbox + webhook, myGov OAuth 2.0, açıq məlumat xidmətləri, OCDS |
| Mənbə kodu və texniki sənədləşdirmə | Repozitoriya, `README.md`, `docs/` | Arxitektura, inteqrasiya, yol xəritəsi, bu sənəd |
| Quraşdırma və işə salma | `README.md` → "İşə salma", "Yerləşdirmə"; `start.bat`, `Dockerfile` | Bir əmrlə lokal; Docker ilə; Vercel + Render |
| Texniki yol xəritəsi | [YOL-XERITESI.md](YOL-XERITESI.md) | 8 həftəlik pilot planı, növbəti modullar, dürüst məhdudiyyətlər |

## Meyarlar

### Funksionallıq və texniki icra (25%)
* Tam dövr işləyir: qeydiyyat (e-poçt və ya myGov) → müraciət → EKTİS → kor qiymətləndirmə → qərar → monitorinq.
* AI modeli (Kaggle, 99.5% test dəqiqliyi) ONNX ilə Java prosesində; 10 illik iqlim riski; Sentinel-2 NDVI; PVGIS.
* 26 avtomatlaşdırılmış backend testi (inteqrasiya + vahid), hər push-da CI; canlı saytda 18 səhifənin masaüstü və mobil yoxlaması; girişli tam ssenari testi.

### İnteqrasiya potensialı və arxitektura (15%)
* EKTİS: transactional outbox, təkrar cəhd, webhook, API açarı; EKTİS dayananda portal işləyir.
* myGov: OAuth 2.0 authorization code axını.
* Açıq məlumat: ANAMA, azstat (CC0), ERA5, Sentinel-2, PVGIS; çıxışda OCDS 1.1 (rəsmi sxemə uyğun).
* Qatlı Spring Boot arxitekturası, OpenAPI 3, H2 / PostgreSQL, Docker.

### İstifadə rahatlığı və UI/UX (15%)
* Dövlət portalı üslubu; sahə səhifəsində qısa xülasə + tablar; 3D xəritə; scroll-craft giriş ekranı.
* AZ / EN / RU; mobil uyğunluq; telefonda "ana ekrana əlavə et" (PWA); internetsiz foto-hesabat.
* Chatbot portal məlumatına və rəsmi statistikaya əsaslanır.

### Problemin həlli və innovativ yanaşma (15%)
* **Torpaq hazırdırmı?** ANAMA sertifikatı, AI bitki tövsiyəsi, iqlim riski, günəş potensialı, stress test → banka təqdim üçün **sahə pasportu (PDF)**.
* **Torpaq verildi, işlənirmi?** Investorun GPS-li foto-hesabatından asılı olmayan **peyk monitorinqi**: yaz otunu əkindən ayırır, 14 ay boş qalan sahəni real Sentinel-2 məlumatı ilə aşkarlayır.
* **Böyük Qayıdış:** qayıdan sakinlərə iş yeri ayrıca qiymətləndirmə meyarı və statistika göstəricisidir.

### Məlumat təhlükəsizliyi və məxfilik (5%)
* Rollar, BCrypt, HttpOnly + SameSite cookie, giriş bloku, sorğu limiti (HTTP 429), CSP / HSTS başlıqları.
* Fayl imzası yoxlaması, FİN maskalanması, PII baxışlarının audit jurnalı, CSV injection qorunması.
* **Kor qiymətləndirmə:** komissiya üzvü bal verənə qədər müraciətçini tanımır.
* **Dəyişdirilə bilməyən qərar jurnalı:** SHA-256 zəncir, `/yoxla` səhifəsində ictimai yoxlama, saxtakarlıq demosu.
* Açıq məlumatda fiziki şəxslərin adları açıqlanmır; çıxışda telefondakı şəxsi keş silinir.

### Demo, təqdimat və suallara cavab (20%)
Təklif olunan 5 dəqiqəlik demo:
1. Ana səhifə (xarıbülbül, scroll) → `/sahe/1`: xülasə, "İqlim riski", "Gəlir kalkulyatoru" + stress test, "Sahə pasportu (PDF)".
2. `/sahe/8?tab=peyk`: "Torpaq verildi, amma 14 aydır əkin görünmür" (real peyk məlumatı).
3. Telefonda müraciət → e-poçt → qiymətləndirici panelində "Müraciətçi A-0xx" (kor) → bal → ad açılır.
4. Qərar → qərar sənədi (QR) → `/yoxla`: hash zənciri yaşıl → "Saxtakarlığı simulyasiya et" → qırmızı → bərpa.
5. Şəffaflıq → OCDS yüklə; Swagger.

### Komanda işi və inkişaf perspektivi (5%)
* Git tarixçəsi kiçik, izahlı commit-lərlə; CI; sənədləşmə.
* [YOL-XERITESI.md](YOL-XERITESI.md): pilot planı, EKTİS / ASAN İmza / kadastr qoşulması, subsidiya və sığorta, mobil inspektor rejimi.
