# Texniki yol xəritəsi

## Hakatondan sonra: pilot versiyaya 8 həftə

| Həftə | İş | Nəticə |
|---|---|---|
| 1 | Texniki audit, Nazirliyin mütəxəssisləri ilə tələblərin dəqiqləşdirilməsi | Təsdiqlənmiş tələblər sənədi |
| 1–2 | EKTİS-in real API spesifikasiyası, test mühitinə qoşulma | `HttpEktisClient` real endpoint-lərlə, müqavilə testləri |
| 2–3 | myGov / ASAN İmza inteqrasiyası (real OAuth müştərisi) | Dövlət identifikasiyası ilə giriş və elektron imza ilə müraciət |
| 3 | Kadastr (Əmlak Xidməti) və ANAMA məlumatlarının avtomatik yenilənməsi | Sahə poliqonları, real minatəmizləmə statusu |
| 3–4 | AI modelinin yerli məlumatla yenidən öyrədilməsi (EKTİS torpaq analizləri, məhsuldarlıq) | Azərbaycan məlumatına əsaslanan model v2, MLOps boru xətti |
| 4–5 | Təhlükəsizlik: CSRF token, şəxsi məlumatların bazada şifrələnməsi, penetrasiya testi | Təhlükəsizlik hesabatı |
| 5–6 | PostgreSQL + PostGIS, fayllar üçün obyekt anbarı, ehtiyat nüsxə | İstehsala hazır infrastruktur |
| 6–7 | Komissiya modulu: bir neçə qiymətləndiricinin müstəqil balı, maraqlar toqquşması bəyannaməsi | Şəffaf kollegial qərar |
| 7 | Yük testi, monitorinq (Prometheus/Grafana), audit jurnalının arxivlənməsi | SLA hədəfləri |
| 8 | Pilot: bir müsabiqə, real istifadəçilər, rəy toplanması | Pilot hesabatı və miqyaslama planı |

## Miqyaslama

* Tətbiq vəziyyətsizdir (sessiya istisna olmaqla, Spring Session + Redis ilə həll olunur), üfüqi genişlənə bilər.
* Outbox sayəsində EKTİS-in yükü və dayanmaları portala təsir etmir; outbox Kafka-ya keçirilə bilər.
* AI inference Java prosesində millisaniyələrlə işləyir, ayrıca GPU və ya Python xidməti tələb etmir.

## Məhdudiyyətlər (dürüst qiymətləndirmə)

* AI modeli açıq Kaggle datasetində (Hindistan məlumatı) öyrədilib. Regional filtr tropik bitkiləri çıxarır, amma
  real istifadə üçün model yerli torpaq analizləri ilə yenidən öyrədilməlidir. Boru xətti buna hazırdır.
* Demo məlumatlar (sahələr, kadastr nömrələri, torpaq göstəriciləri) nümayiş üçündür.
* EKTİS və myGov simulyatorlarla göstərilir; real qoşulma səlahiyyətli qurumun razılığı ilə aparılmalıdır.
