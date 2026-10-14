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
```

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
