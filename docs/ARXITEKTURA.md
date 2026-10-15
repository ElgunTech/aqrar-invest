# Arxitektura və məlumat modeli

## Ümumi baxış

```mermaid
flowchart LR
  subgraph Brauzer
    UI[React SPA<br/>xəritə, kataloq, müraciət, kabinet, admin]
  end
  subgraph Portal["Aqrar İnvest (Spring Boot, tək JAR)"]
    API[REST API /api/v1]
    SEC[Spring Security<br/>rollar, sessiya, API açarı]
    SVC[Servislər<br/>müraciət, müsabiqə, sahə, statistika]
    AI[CropRecommendationService<br/>ONNX Runtime]
    OUT[Outbox prosessoru]
    DB[(PostgreSQL / H2)]
    FS[(Sənəd anbarı)]
  end
  subgraph Xarici["Xarici dövlət sistemləri"]
    EKTIS[EKTİS]
    MYGOV[myGov identifikasiya]
  end
  subgraph Aciq["Açıq məlumat xidmətləri"]
    S2[Sentinel-2<br/>Planetary Computer]
    PVG[PVGIS<br/>Avropa Komissiyası JRC]
    MAIL[Brevo<br/>e-poçt API]
  end
  UI -->|HTTPS, sessiya cookie| API
  API --> SEC --> SVC
  SVC --> DB
  SVC --> FS
  SVC --> AI
  SVC -->|eyni tranzaksiyada hadisə| DB
  OUT -->|X-API-Key, JSON| EKTIS
  EKTIS -->|webhook /api/v1/integration/ektis/events| API
  UI -->|OAuth 2.0| MYGOV
  API -->|kod → token → userinfo| MYGOV
  SVC -->|STAC axtarışı, NDVI statistikası| S2
  SVC -->|PVcalc, kWh/kWp| PVG
  SVC -->|bildirişin surəti| MAIL
```

**Qatlar** (`backend/src/main/java/az/agro/portal`):

| Paket | Məsuliyyət |
|---|---|
| `domain` | JPA entity-lər və status maşınları (`ApplicationStatus.allowedNext()`) |
| `repo` | Spring Data repozitoriyaları |
| `service` | Biznes qaydaları: müraciət, qiymətləndirmə, dörd göz prinsipi, outbox |
| `web` | REST controller-lər, xəta formatı |
| `security` | Rollar, sessiya, giriş bloku, sistemlərarası API açarı |
| `integration` | `EktisClient`, `MyGovClient` portları və onların simulyatorları |
| `ai` | ONNX modelinin yüklənməsi, regional filtr, fallback |
| `config` | Demo məlumatlar, OpenAPI, SPA marşrutlaması |

Xarici açıq xidmətlərə gedən servislər (`SatelliteService`, `SolarService`, `MailService`) nəticəni yaddaşda saxlayır və xidmət cavab vermədikdə portalın qalanı işləməyə davam edir: istifadəçiyə "xidmət hazırda cavab vermir" göstərilir, e-poçt göndərilməsə yalnız loga yazılır.

Xarici sistemlərə yalnız interfeys vasitəsilə (`EktisClient`, `MyGovClient`) müraciət olunur: real sistemə keçid konfiqurasiya dəyişikliyidir.

## Məlumat modeli (ER diaqramı)

```mermaid
erDiagram
  APP_USER ||--o{ INVESTMENT_APPLICATION : "müraciət edir"
  APP_USER ||--o{ NOTIFICATION : alır
  APP_USER ||--o{ COMPETITION : "yaradır / təsdiqləyir"
  COMPETITION }o--o{ LAND_PLOT : "competition_plot"
  COMPETITION ||--o{ INVESTMENT_APPLICATION : "üzrə"
  LAND_PLOT ||--o{ INVESTMENT_APPLICATION : "üçün"
  INVESTMENT_APPLICATION ||--o{ APPLICATION_DOCUMENT : sənədlər
  INVESTMENT_APPLICATION ||--o{ STATUS_CHANGE : tarixçə
  INVESTMENT_APPLICATION ||..o{ INTEGRATION_EVENT : "aggregateId"
  INVESTMENT_APPLICATION ||--o{ EVALUATOR_SCORE : "komissiya balları"
  APP_USER ||--o{ EVALUATOR_SCORE : "qiymətləndirir"
  INVESTMENT_APPLICATION ||--o{ MILESTONE : "öhdəlik mərhələləri"
  INVESTMENT_APPLICATION ||..o{ LEDGER_ENTRY : "applicationNumber (hash zənciri)"
  APPLICATION_DOCUMENT ||..o| STORED_BLOB : "storedName (faylın baza surəti)"
  MILESTONE ||..o| STORED_BLOB : "foto"

  APP_USER {
    bigint id PK
    string email UK
    string password_hash
    string full_name
    enum role "INVESTOR | EVALUATOR | ADMIN"
    string tax_id "FİN / VÖEN"
    string phone
  }
  LAND_PLOT {
    bigint id PK
    string code UK "QR-AGD-001"
    string cadastre_number "kadastr açarı"
    string district
    double latitude
    double longitude
    double area_ha
    enum activity_type
    double nitrogen_phosphorus_potassium_ph "AI girişləri"
    double avg_temperature_humidity_rainfall "AI girişləri"
    enum mine_clearance "CLEARED | IN_PROGRESS | PLANNED"
    int lease_years
    bigint min_investment
    enum status "AVAILABLE | IN_COMPETITION | ASSIGNED"
  }
  COMPETITION {
    bigint id PK
    string code UK "MQ-2026-001"
    string title
    date deadline
    enum status "DRAFT | PENDING_APPROVAL | PUBLISHED | CLOSED"
    bigint created_by FK
    bigint approved_by FK "≠ created_by"
  }
  INVESTMENT_APPLICATION {
    bigint id PK
    string application_number UK "QIM-2026-000042"
    bigint applicant_id FK
    bigint competition_id FK
    bigint plot_id FK
    string tax_id
    bigint planned_investment
    int jobs_created
    enum status "SUBMITTED | UNDER_REVIEW | INFO_REQUESTED | APPROVED | REJECTED"
    int auto_score "0-100, izahlı"
    enum ektis_status "NOT_SENT | SENT | VERIFIED | FAILED"
    string ektis_reference
  }
  APPLICATION_DOCUMENT {
    bigint id PK
    enum doc_type
    string original_name
    string stored_name "təsadüfi UUID"
    bigint size_bytes
  }
  STATUS_CHANGE {
    bigint id PK
    enum from_status
    enum to_status
    string comment_text
    string changed_by
    timestamp changed_at
  }
  NOTIFICATION {
    bigint id PK
    string title
    boolean is_read
  }
  AUDIT_LOG {
    bigint id PK
    string actor
    string action "LOGIN, PII_VIEWED, ..."
    string entity_type
    string ip_address
    timestamp created_at
  }
  INTEGRATION_EVENT {
    bigint id PK
    enum direction "OUTBOUND | INBOUND"
    string event_type
    text payload "JSON, schemaVersion 1.0"
    enum status "PENDING | SENT | FAILED | RECEIVED"
    int attempts
    string external_reference
  }
  EVALUATOR_SCORE {
    bigint id PK
    bigint application_id FK
    bigint evaluator_id FK
    int feasibility "0-10"
    int financing "0-10"
    int social_impact "0-10"
    int technology "0-10"
    boolean no_conflict_declared
  }
  MILESTONE {
    bigint id PK
    bigint application_id FK
    int seq "1-4"
    int investment_percent "20/50/80/100"
    date due_date
    enum status "PLANNED | REPORTED | ACCEPTED | REJECTED"
    bigint reported_investment
    double photo_lat
    double photo_lng
    boolean gps_inside_plot
    int gps_distance_m
  }
  LEDGER_ENTRY {
    bigint id PK "zəncirdə sıra"
    string application_number
    enum kind "STATUS | SCORE"
    text payload "kanonik JSON"
    string prev_hash "SHA-256"
    string hash "SHA-256(prev|nömrə|növ|payload)"
  }
  STORED_BLOB {
    string name PK
    bytea content "5 MB-a qədər"
  }
```

Şəkil və sənədlər diskdə saxlanılır, eyni zamanda `STORED_BLOB`-a surəti yazılır (efemer diskli hostinqdə itməsin). `LEDGER_ENTRY` yalnız əlavə olunur, heç vaxt yenilənmir.

## Müraciətin həyat dövrü

```mermaid
stateDiagram-v2
  [*] --> SUBMITTED: sahibkar göndərir\n(nömrə + avtomatik bal)
  SUBMITTED --> UNDER_REVIEW: qiymətləndirici
  SUBMITTED --> REJECTED: səbəb məcburi
  UNDER_REVIEW --> INFO_REQUESTED: səbəb məcburi
  INFO_REQUESTED --> UNDER_REVIEW: sahibkar cavab verir\n(+ sənəd)
  INFO_REQUESTED --> REJECTED
  UNDER_REVIEW --> APPROVED: sahə ASSIGNED olur
  UNDER_REVIEW --> REJECTED
  APPROVED --> [*]
  REJECTED --> [*]
```

Hər keçid: tarixçəyə yazılır, sahibkara bildiriş gedir, EKTİS-ə `APPLICATION_STATUS_CHANGED` hadisəsi növbəyə qoyulur, audit jurnalına qeyd düşür.

## Müsabiqənin həyat dövrü (dörd göz prinsipi)

```mermaid
stateDiagram-v2
  [*] --> DRAFT: qiymətləndirici və ya admin yaradır
  DRAFT --> PENDING_APPROVAL: təsdiqə göndərilir
  PENDING_APPROVAL --> DRAFT: geri qaytarılır (qeyd ilə)
  PENDING_APPROVAL --> PUBLISHED: BAŞQA administrator təsdiqləyir
  PUBLISHED --> CLOSED
```

## AI komponenti

```mermaid
flowchart LR
  K[Kaggle notebook<br/>6 alqoritm müqayisəsi] -->|RandomForest| O[crop_model.onnx<br/>model_meta.json]
  O --> J[ONNX Runtime<br/>Java prosesində]
  J --> F[Regional iqlim filtri<br/>tropik bitkilər çıxarılır]
  F --> R1[Sahə səhifəsi: top-3 bitki]
  F --> R2[Uyğunluq testi: AI balı]
  F --> R3[Müraciətin avtomatik balı: 15/100]
  F --> R4[Torpaq laboratoriyası]
```

* Test dəqiqliyi 99.5%, 5-fold CV 99.4%, macro F1 99.5%.
* Model yoxdursa, şəffaf fallback (sentroid evristikası) işləyir və cavabda `engine: FALLBACK` yazılır.
* Diapazondan kənar girişlər (`outOfRange`) istifadəçiyə açıq bildirilir.

## Peyk monitorinqi (NDVI)

```mermaid
flowchart LR
  P[Sahənin ANAMA sərhədi] --> Q[STAC axtarışı<br/>Sentinel-2 L2A, buludluluq < 25%]
  Q --> M[Hər ay üçün ən az buludlu görüntü]
  M --> N[NDVI = B08−B04 / B08+B04<br/>sərhəd daxilində orta]
  N --> D{Qərar tarixi var?}
  D -->|yox| B[İlkin vəziyyət]
  D -->|bəli| Y[Yay ayları iyun–sentyabr<br/>və ötən ilin həmin ayı]
  Y -->|yay NDVI ≥ 0.35 və ya artım ≥ 0.12| A[Əkin aşkarlanır]
  Y -->|6 ay keçib, əkin yoxdur| X[Qırmızı xəbərdarlıq]
  Y -->|yay hələ gəlməyib| W[Gözləmə]
```

Qarabağda yazda yağışdan sonra bütün boş sahələr yaşıllaşır (NDVI 0.3–0.45) və iyulda quruyur. Ona görə yazdakı pik əkin sübutu sayılmır; 18 real sahənin hamısında bu nümunə müşahidə olunub. Qayda `SatelliteService.assess`-dədir və `SatelliteAssessTest` ilə yoxlanılır.

## Günəş enerjisi

* İstehsal potensialı: PVGIS 5.3, sahənin mərkəzi, optimal bucaqlı sabit konstruksiya, 14% itki.
* Uyğunluq balı (100): günəş potensialı 40, minatəmizləmə 25 (təmizlənməyibsə "hazırda uyğun deyil"), şəbəkəyə qoşulma 15, fəaliyyətlə uyğunluq 20.
* Tariflər: Tarif (Qiymət) Şurasının 29.12.2024 tarixli 19 nömrəli qərarı: günəşdən alış 8.5 qəpik/kWh, kənd təsərrüfatı istehlakı 10.6 qəpik/kWh.
* Ssenarilər: aktiv istehlakçı (150 kW-a qədər, Azərişıq şəbəkəsinə qoşulma) və aqrovoltaik stansiya (150 kW-dan yuxarı tarif auksionla müəyyən edilir; hesabda 8.5 qəpik istinad).
* Xərclər (₼/kWp, istismar 1.5%, deqradasiya 0.5%/il, şəbəkənin CO₂ əmsalı 0.45 kq/kWh) planlaşdırma fərziyyələridir və ekranda dəyişdirilə bilər.
