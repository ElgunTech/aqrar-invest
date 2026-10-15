# Texniki yol xəritəsi

## Hazırda işləyən (prototip)

| Sahə | Hazırdır |
|---|---|
| Portal | Kataloq, axtarış və filtrlər, 2D və 3D xəritə, müqayisə, 5 addımlı elektron müraciət, QR qəbz, status izləmə, bildirişlər (portal + e-poçt), AZ / EN / RU |
| İdarəetmə | İnzibati panel, müsabiqə (dörd göz prinsipi), komissiya (≥2 müstəqil bal, maraqlar toqquşması), kor qiymətləndirmə, QR-lı qərar sənədi, audit jurnalı |
| Monitorinq | Öhdəlik mərhələləri, GPS-li foto-hesabat, internetsiz hesabat (oflayn növbə), peyk NDVI (Sentinel-2), dürüstlük siqnalları |
| Analitika | AI bitki tövsiyəsi (ONNX), 10 illik iqlim riski (ERA5), günəş uyğunluğu (PVGIS + rəsmi tariflər), gəlir kalkulyatoru və stress test, sahə pasportu (PDF) |
| Şəffaflıq | Açıq statistika, OCDS 1.1 açıq məlumat, SHA-256 hash zəncirli qərar jurnalı və ictimai yoxlama |
| İnteqrasiya | EKTİS (outbox + webhook, simulyator), myGov OAuth 2.0 (simulyator), ANAMA və azstat açıq məlumatları, OpenAPI 3 |
| İnfrastruktur | Docker, PostgreSQL (Neon) / H2, Vercel + Render, CI (GitHub Actions), CSP / HSTS, sorğu limiti, PWA |

## Hakatondan sonra: pilot versiyaya 8 həftə

| Həftə | İş | Nəticə |
|---|---|---|
| 1 | Nazirliyin mütəxəssisləri ilə tələblərin dəqiqləşdirilməsi, məlumat sahiblərinin müəyyənləşdirilməsi | Təsdiqlənmiş tələblər və məlumat mübadiləsi razılaşmaları |
| 1–2 | EKTİS-in real API spesifikasiyası, test mühitinə qoşulma | `HttpEktisClient` real endpoint-lərlə, müqavilə testləri |
| 2–3 | myGov / ASAN İmza (real OAuth müştərisi, qərar və müraciətin elektron imzası) | Dövlət identifikasiyası və hüquqi qüvvəli imza |
| 3 | Kadastr (Əmlak Xidməti) və ANAMA ilə avtomatik sinxronizasiya | Rəsmi poliqonlar və minatəmizləmə statusu real vaxtda |
| 3–4 | AI modelinin yerli torpaq analizləri və məhsuldarlıqla yenidən öyrədilməsi; iqlim həddlərinin yerli sortlara uyğunlaşdırılması | Azərbaycan məlumatına əsaslanan model v2, MLOps boru xətti |
| 4 | Aqrar Subsidiya Şurası və aqrar sığorta məlumatlarının kalkulyatora qoşulması | Subsidiya və sığorta ilə xalis gəlir |
| 4–5 | Təhlükəsizlik: şəxsi məlumatların bazada şifrələnməsi, açarların gizli anbara (Vault) keçirilməsi, penetrasiya testi | Təhlükəsizlik hesabatı |
| 5 | Hash zəncirinin son hash-inin dövri dərci (Nazirliyin saytında / zaman damğası xidmətində) | Bazanın tam yenidən yazılması belə aşkarlanır |
| 5–6 | PostGIS, fayllar üçün obyekt anbarı (S3 uyğun), ehtiyat nüsxə və bərpa testi | İstehsala hazır infrastruktur |
| 6–7 | Yük testi, monitorinq (Prometheus / Grafana), xəta izləmə, SLA | Ölçülmüş performans |
| 8 | Pilot: bir müsabiqə, real sahibkarlar və komissiya, rəy toplanması | Pilot hesabatı və miqyaslama planı |

## Növbəti modullar (pilotdan sonra)

* İctimai dinləmə: yerli sakinlərin müsabiqə sahələri barədə rəyi.
* Rəhbərlik paneli: rayonlar üzrə investisiya, iş yerləri və öhdəliklərin icrası.
* Peyk monitorinqinin avtomatik xəbərdarlığı: "boş qalan sahə" aşkarlananda inspektora tapşırıq.
* Mobil tətbiq (mövcud PWA əsasında) və inspektor üçün sahə yoxlama rejimi.

## Miqyaslama

* Tətbiq vəziyyətsizdir (sessiya istisna olmaqla, Spring Session + Redis ilə həll olunur), üfüqi genişlənə bilər.
* Outbox sayəsində EKTİS-in yükü və dayanmaları portala təsir etmir; outbox Kafka-ya keçirilə bilər.
* AI inference Java prosesində millisaniyələrlə işləyir, ayrıca GPU və ya Python xidməti tələb etmir.
* Peyk, iqlim və günəş hesablamaları keşlənir; xarici xidmət dayananda portalın qalanı işləməyə davam edir.

## Məhdudiyyətlər (dürüst qiymətləndirmə)

* AI modeli açıq Kaggle datasetində öyrədilib. Regional filtr tropik bitkiləri çıxarır, amma real istifadə üçün
  model yerli torpaq analizləri ilə yenidən öyrədilməlidir. Boru xətti buna hazırdır.
* Sahələrin sərhədləri, sahəsi və minatəmizləmə tarixi realdır (ANAMA); torpaq göstəriciləri, infrastruktur
  məsafələri, investisiya şərtləri və müraciətçilər nümunəvidir.
* EKTİS və myGov simulyatorlarla göstərilir; real qoşulma səlahiyyətli qurumun razılığı ilə aparılmalıdır.
* Kalkulyatorun xərc və qiymətləri, günəş quraşdırma xərci və bitkilərin iqlim həddləri redaktə edilə bilən istinad dəyərləridir.
