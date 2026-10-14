import { useT } from "../lib/i18n";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ClipboardList, FileCheck2, Map, QrCode, Search, Sprout, Code2 } from "lucide-react";
import { Loading } from "../components/ui";
import { ACTIVITY } from "../lib/domain";
import { money, num } from "../lib/format";
import { useApi, useDocumentTitle, useMeta } from "../lib/hooks";
import type { Competition, PublicStats } from "../lib/types";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

const SERVICES = [
  { to: "/kataloq", icon: Search, title: "Sahə axtarışı", text: "Müsabiqəyə çıxarılan torpaq sahələri" },
  { to: "/xerite", icon: Map, title: "İnvestisiya xəritəsi", text: "Sahələr xəritədə, peyk görüntüsü ilə" },
  { to: "/kabinet", icon: ClipboardList, title: "Elektron müraciət", text: "Müraciət və statusun izlənməsi" },
  { to: "/yoxla", icon: QrCode, title: "Qəbzin yoxlanması", text: "Müraciət qəbzinin həqiqiliyi" },
  { to: "/ai", icon: Sprout, title: "Bitki məsləhətçisi", text: "Torpağa uyğun bitki tövsiyəsi" },
  { to: "/seffafliq", icon: FileCheck2, title: "Açıq statistika", text: "Müsabiqələrin gedişi və qərarlar" },
];

export default function Home() {
  const { t } = useT();
  useDocumentTitle(t("Ana səhifə"));
  const nav = useNavigate();
  const meta = useMeta();
  const [q, setQ] = useState("");
  const { data: stats } = useApi<PublicStats>("/api/v1/public/stats");
  const { data: comps } = useApi<Competition[]>("/api/v1/public/competitions");
  const [tab, setTab] = useState<string>("CROP_FARMING");

  const search = (e: FormEvent) => {
    e.preventDefault();
    nav(`/kataloq?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <section className="home-hero">
        <img src="/world/03-fields.jpg" srcSet="/world/03-fields-m.jpg 1100w, /world/03-fields.jpg 2400w" sizes="100vw" alt="Füzuli rayonunda əkin sahələri" />
        <div className="wrap home-hero__inner">
          <p className="home-hero__kicker">{t("Qarabağ iqtisadi rayonu")}</p>
          <h1>{t("Kənd təsərrüfatı torpaqlarına investisiya müsabiqəsi")}</h1>
          <form className="home-search" onSubmit={search} role="search">
            <label htmlFor="home-q">{t("Sahə üzrə axtarış:")}</label>
            <div className="home-search__row">
              <input id="home-q" className="input" placeholder={t("Kənd, rayon və ya sahə kodu")} value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn">{t("Axtarış")}</button>
            </div>
            <div className="home-search__hints">
              <span>{t("Məsələn,")}</span>
              {(meta?.districts ?? []).slice(0, 4).map((d) => <Link key={d} to={`/kataloq?q=${encodeURIComponent(d)}`}>{d}</Link>)}
            </div>
          </form>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <div className="home-row">
          <section className="panel">
            <div className="home-block__head"><h2>{t("Müsabiqə elanları")}</h2><Link to="/musabiqeler">{t("Bütün elanlar")}</Link></div>
            {!comps ? <Loading /> : (
              <ul className="notice-list">
                {comps.map((c) => {
                  const d = new Date(c.deadline + "T00:00:00");
                  return (
                    <li key={c.id}>
                      <div className="notice-date"><b>{d.getDate()}</b><span>{t(MONTHS[d.getMonth()])}</span></div>
                      <div className="grow">
                        <Link to={`/musabiqeler#c${c.id}`} className="notice-title">{c.title}</Link>
                        <div className="faint" style={{ fontSize: 12.5 }}>{c.code} · {c.plots.length} {t("sahə")} · {t("son müraciət tarixi")} · {c.open ? t("{n} gün qalıb", { n: c.daysLeft }) : c.status.label}</div>
                      </div>
                      <ChevronRight size={18} color="#9aa29d" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="panel">
            <div className="home-block__head"><h2>{t("Əsas göstəricilər")}</h2><Link to="/seffafliq">{t("Ətraflı")}</Link></div>
            {!stats ? <Loading /> : (
              <table className="table table--kv">
                <tbody>
                  <tr><td>{t("Təklif olunan sahələr")}</td><td className="num"><b>{stats.plotCount}</b></td></tr>
                  <tr><td>{t("Ümumi ərazi")}</td><td className="num"><b>{num(stats.totalAreaHa)} ha</b></td></tr>
                  <tr><td>{t("Minadan təmizlənmiş sahələr")}</td><td className="num"><b>{stats.clearedPlots}</b></td></tr>
                  <tr><td>{t("Açıq müsabiqələr")}</td><td className="num"><b>{stats.openCompetitions}</b></td></tr>
                  <tr><td>{t("Daxil olan müraciətlər")}</td><td className="num"><b>{stats.applicationCount}</b></td></tr>
                  <tr><td>{t("Planlaşdırılan investisiya")}</td><td className="num"><b>{money(stats.plannedInvestment)}</b></td></tr>
                  <tr><td>{t("Yaradılacaq iş yerləri")}</td><td className="num"><b>{num(stats.plannedJobs)}</b></td></tr>
                  <tr><td>{t("Onlardan qayıdan sakinlər üçün")}</td><td className="num"><b>{num(stats.returneeJobs)}</b></td></tr>
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

      <section className="home-band">
        <div className="wrap">
          <div className="sec-title"><h2>{t("Elektron xidmətlər")}</h2></div>
          <div className="service-grid">
            {SERVICES.map(({ to, icon: Icon, title, text }) => (
              <Link key={to} to={to} className="service">
                <Icon size={28} />
                <span><b>{t(title)}</b><span>{t(text)}</span></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap" style={{ padding: "48px var(--gutter)" }}>
        <div className="sec-title"><h2>{t("Fəaliyyət istiqamətləri üzrə sahələr")}</h2></div>
        <div className="tabs" role="tablist" style={{ justifyContent: "center" }}>
          {meta?.activityTypes.map((a) => (
            <button key={a.code} role="tab" aria-selected={tab === a.code} onClick={() => setTab(a.code)}>{t(a.label)}</button>
          ))}
        </div>
        <ActivityPlots activity={tab} />
      </section>

      <section className="home-band">
        <div className="wrap">
          <div className="sec-title"><h2>{t("İnteqrasiya olunan dövlət sistemləri")}</h2><p>{t("Prototipdə simulyasiya ilə nümayiş etdirilir")}</p></div>
          <div className="service-grid service-grid--3">
            <div className="service service--static"><Code2 size={26} /><span><b>EKTİS</b><span>{t("Elektron Kənd Təsərrüfatı İnformasiya Sistemi: müraciətlər və fermer reyestri")}</span></span></div>
            <div className="service service--static"><Code2 size={26} /><span><b>myGov</b><span>{t("Dövlət identifikasiyası ilə giriş (OAuth 2.0)")}</span></span></div>
            <div className="service service--static"><Code2 size={26} /><span><b>{t("Minatəmizləmə məlumatları")}</b><span>{t("Sahələrin minadan təmizlənmə statusu və tarixi")}</span></span></div>
          </div>
        </div>
      </section>
    </>
  );
}

function ActivityPlots({ activity }: { activity: string }) {
  const { data } = useApi<{ id: number; code: string; title: string; district: string; areaHa: number; minInvestment: number; openCompetition: unknown }[]>(`/api/v1/public/plots?activity=${activity}`);
  const { t } = useT();
  const a = ACTIVITY[activity];
  if (!data) return <Loading />;
  if (data.length === 0) return <p className="center muted" style={{ textAlign: "center" }}>{t("Bu istiqamət üzrə sahə yoxdur.")}</p>;
  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead><tr><th>{t("Kod")}</th><th>{t("Sahə")}</th><th>{t("Rayon")}</th><th className="num">{t("Ərazi")}</th><th className="num">{t("Min. investisiya")}</th><th>{t("Status")}</th><th /></tr></thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id}>
              <td className="mono" style={{ color: a?.color }}>{p.code}</td>
              <td>{p.title}</td>
              <td>{p.district}</td>
              <td className="num">{num(p.areaHa, 1)} ha</td>
              <td className="num">{money(p.minInvestment)}</td>
              <td>{p.openCompetition ? <span style={{ color: "var(--forest-600)", fontWeight: 500 }}>{t("Müsabiqədə")}</span> : <span className="faint">{t("Müsabiqədə deyil")}</span>}</td>
              <td className="num"><Link to={`/sahe/${p.id}`}>{t("Ətraflı")}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
