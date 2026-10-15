import { ClimatePanel } from "../components/Climate";
import { useT } from "../lib/i18n";
import { SolarPanel } from "../components/Solar";
import { SatellitePanel } from "../components/Satellite";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { Box,
  ArrowRight, BarChart3, CloudSun, FileDown, CalendarClock, Calculator as CalcIcon, Check, ChevronRight, Droplets, FileText, Landmark, MapPin, Route, Satellite, Scale, Sprout, Sun, Zap, X as XIcon,
} from "lucide-react";
import { Calculator } from "../components/Calculator";
import { Callout, Empty, Loading, Meter, MineTag, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { ACTIVITY } from "../lib/domain";
import { countdown, date, money, num, pct1, fit } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { CropRecommendation, OfficialIndicator, Plot } from "../lib/types";

type TabKey = "umumi" | "ai" | "iqlim" | "gelir" | "gunes" | "peyk" | "statistika";
const TABS: { key: TabKey; label: string; icon: typeof Sun }[] = [
  { key: "umumi", label: "Ümumi", icon: Landmark },
  { key: "ai", label: "Torpaq və AI", icon: Sprout },
  { key: "iqlim", label: "İqlim riski", icon: CloudSun },
  { key: "gelir", label: "Gəlir kalkulyatoru", icon: CalcIcon },
  { key: "gunes", label: "Günəş enerjisi", icon: Sun },
  { key: "peyk", label: "Peyk monitorinqi", icon: Satellite },
  { key: "statistika", label: "Rəsmi statistika", icon: BarChart3 },
];
const SOLAR_SHORT = { HIGH: "yüksək uyğunluq", GOOD: "uyğundur", LIMITED: "məhdud", BLOCKED: "hazırda uyğun deyil" } as const;

export function AiCard({ rec, inputs }: { rec: CropRecommendation; inputs?: Plot }) {
  const shown = rec.recommendations.filter((c) => c.probability >= 0.01);
  const list = shown.length ? shown : rec.recommendations.slice(0, 1);
  const filtered = rec.rawTop.some((c) => !c.regionSuitable && c.probability > 0.01);
  return (
    <section className="panel">
      <div className="panel__head">
        <h3>Süni intellekt: bu torpaqda nə əkmək sərfəlidir?</h3>
        <span className="model-badge"><span className="dot" />{rec.modelLoaded ? `${rec.modelName}${rec.testAccuracy ? " · dəqiqlik " + pct1(rec.testAccuracy) : ""}` : "Müvəqqəti alqoritm"}</span>
      </div>
      <div className="panel__body">
        <div className={inputs ? "grid grid--2" : ""} style={{ gap: 28 }}>
          <div>
            {list.map((c, i) => (
              <div className="crop" key={c.code}>
                <span className="crop__name">{i === 0 && <Tag tone="gold">Ən uyğun</Tag>} {c.name}</span>
                <span className="crop__pct">{fit(c.probability)}</span>
                <Meter value={c.probability} gold={i === 0} />
              </div>
            ))}
            <p className="muted" style={{ fontSize: 13.5, marginTop: 14 }}>{rec.explanation}</p>
            <p className="ai-note"><b>ML nümayişi, məsləhət xarakterlidir.</b> açıq Kaggle datasetində (Crop Recommendation, 2 200 nümunə) öyrədilib; regional iqlim filtri tropik bitkiləri çıxarır. Real istifadədən əvvəl yerli torpaq analizləri ilə yenidən öyrədilməlidir. Nəticə qərar deyil, ilkin istiqamətdir: iqlim riski tabı ilə birlikdə baxın.</p>
            {filtered && <div style={{ marginTop: 12 }}><Callout tone="warn">Model tropik bitki də təklif etdi, lakin regional iqlim filtri onu çıxardı.</Callout></div>}
          </div>
          {inputs && (
            <div>
              <h4 style={{ marginBottom: 8 }}>Modelin giriş göstəriciləri</h4>
              <table className="table table--kv table--compact">
                <tbody>
                  <tr><td>Azot (N)</td><td className="num">{num(inputs.nitrogen)} kq/ha</td></tr>
                  <tr><td>Fosfor (P)</td><td className="num">{num(inputs.phosphorus)} kq/ha</td></tr>
                  <tr><td>Kalium (K)</td><td className="num">{num(inputs.potassium)} kq/ha</td></tr>
                  <tr><td>Torpağın pH-ı</td><td className="num">{num(inputs.ph, 1)}</td></tr>
                  <tr><td>Orta temperatur</td><td className="num">{num(inputs.avgTemperature, 1)} °C</td></tr>
                  <tr><td>Nisbi rütubət</td><td className="num">{num(inputs.humidity)}%</td></tr>
                  <tr><td>Yağıntı</td><td className="num">{num(inputs.rainfall)} mm</td></tr>
                </tbody>
              </table>
              <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>Model Kaggle-da öyrədilib və ONNX formatında birbaşa portalın Java serverində işləyir.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OfficialStats({ district }: { district: string }) {
  const { data } = useApi<OfficialIndicator[]>(`/api/v1/public/official/district/${encodeURIComponent(district)}`);
  if (!data || data.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel__head"><h3>{district} rayonu: rəsmi statistika</h3><span className="faint" style={{ fontSize: 12.5 }}>Dövlət Statistika Komitəsi</span></div>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead><tr><th>Göstərici</th><th className="num">İl</th><th className="num">Rayon</th><th className="num">Qarabağ i/r</th><th className="num">Ölkə</th><th>10 il</th></tr></thead>
          <tbody>
            {data.map((i) => {
              const max = Math.max(...i.series.map((s) => s.value));
              return (
                <tr key={i.key}>
                  <td>{i.label}, <span className="faint">{i.unit}</span></td>
                  <td className="num">{i.year}</td>
                  <td className="num"><b>{num(i.district, 1)}</b></td>
                  <td className="num">{i.region != null ? num(i.region, 1) : "yoxdur"}</td>
                  <td className="num">{i.national != null ? num(i.national, 1) : "yoxdur"}</td>
                  <td>
                    <span className="spark" aria-label="10 illik dinamika">
                      {i.series.map((s) => <i key={s.year} title={`${s.year}: ${s.value}`} style={{ height: `${Math.max(8, (s.value / max) * 100)}%` }} />)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="panel__foot faint" style={{ fontSize: 12.5 }}>Mənbə: azstat.gov.az açıq məlumat API-si (CC0), opendata.az. Rayonlar işğal dövründə uçotdan kənarda qaldığı üçün bəzi göstəricilər yalnız son illər üzrə mövcuddur.</div>
    </section>
  );
}

export default function PlotDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: p, error } = useApi<Plot>(`/api/v1/public/plots/${id}`);
  const { data: rec } = useApi<CropRecommendation>(`/api/v1/public/plots/${id}/recommendation`);
  const { data: solar } = useApi<{ score: number; verdictCode: keyof typeof SOLAR_SHORT }>(`/api/v1/public/plots/${id}/solar`);
  useDocumentTitle(p?.title ?? "Sahə");
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabKey) || "umumi";
  const go = (k: TabKey) => {
    setParams((prev) => { const n = new URLSearchParams(prev); if (k === "umumi") n.delete("tab"); else n.set("tab", k); return n; }, { replace: true });
    document.getElementById("plot-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) return <div className="wrap page"><div className="panel"><Empty title="Sahə tapılmadı"><Link className="btn" to="/kataloq" style={{ marginTop: 14 }}>Kataloqa qayıt</Link></Empty></div></div>;
  if (!p) return <Loading />;

  const a = ACTIVITY[p.activityType.code];
  const comp = p.openCompetition;
  const yes = (b: boolean) => (b ? <span className="row" style={{ ["--gap" as string]: "6px", color: "var(--forest-600)" }}><Check size={16} /> Var</span> : <span className="row" style={{ ["--gap" as string]: "6px", color: "var(--ink-faint)" }}><XIcon size={16} /> Yoxdur</span>);

  let action;
  if (!comp) {
    action = <Callout tone="warn">{p.status.code === "ASSIGNED" ? "Sahə artıq müsabiqə qalibinə təhvil verilib." : "Bu sahə hazırda açıq müsabiqədə deyil."}</Callout>;
  } else if (!user) {
    action = <Link className="btn btn--lg btn--block" to={`/giris?next=${encodeURIComponent(`/muraciet?plot=${p.id}&competition=${comp.id}`)}`}>Daxil olub müraciət et</Link>;
  } else if (user.role !== "INVESTOR") {
    action = <Callout tone="info">Müraciəti yalnız sahibkar hesabı ilə vermək olar.</Callout>;
  } else {
    action = <Link className="btn btn--lg btn--block" to={`/muraciet?plot=${p.id}&competition=${comp.id}`}>Müraciət et <ArrowRight size={18} /></Link>;
  }

  return (
    <>
      <section className="band">
        <div className="wrap">
          <nav className="crumbs" aria-label="Naviqasiya"><Link to="/kataloq">Kataloq</Link> / <span>{p.district}</span> / <span className="mono">{p.code}</span></nav>
          <div className="row row--top" style={{ ["--gap" as string]: "18px" }}>
                        <div className="grow">
              <div className="row" style={{ marginBottom: 10 }}>
                <Tag tone="muted">{p.activityType.label}</Tag>
                <MineTag label={p.mineClearance} />
                <Tag label={p.status} />
              </div>
              <h1>{p.title}</h1>
              <p className="row" style={{ ["--gap" as string]: "6px" }}><MapPin size={16} /> {p.district} rayonu, {p.village} kəndi · ANAMA sahə kodu <span className="mono">{p.anamaRef ?? "yoxdur"}</span></p>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap page">
        <div className="layout-2">
          <div className="stack" style={{ ["--gap" as string]: "22px" }}>
            <div className="grid grid--4">
              <div className="panel metric"><div className="metric__label">Ərazi</div><div className="metric__value">{num(p.areaHa, 1)} ha</div></div>
              <div className="panel metric"><div className="metric__label">Min. investisiya</div><div className="metric__value" style={{ fontSize: 22 }}>{money(p.minInvestment)}</div></div>
              <div className="panel metric"><div className="metric__label">İcarə müddəti</div><div className="metric__value">{p.leaseYears} il</div></div>
              <div className="panel metric"><div className="metric__label">Müraciətlər</div><div className="metric__value">{p.applicationCount}</div></div>
            </div>

            <div className="glance">
              <button className="glance__item" onClick={() => go("ai")}>
                <Sprout size={20} />
                <span><small>{t("Ən uyğun bitki (AI)")}</small><b>{rec?.recommendations[0] ? `${rec.recommendations[0].name} · ${t(fit(rec.recommendations[0].probability))}` : "…"}</b></span>
                <ChevronRight size={16} />
              </button>
              <button className="glance__item" onClick={() => go("gunes")}>
                <Sun size={20} />
                <span><small>{t("Günəş paneli")}</small><b>{solar ? `${solar.score}/100 · ${SOLAR_SHORT[solar.verdictCode]}` : "…"}</b></span>
                <ChevronRight size={16} />
              </button>
              <button className="glance__item" onClick={() => go("umumi")}>
                <Zap size={20} />
                <span><small>{t("İnfrastruktur")}</small><b>{p.electricityAvailable ? "Elektrik var" : "Elektrik yoxdur"} · su {num(p.waterSourceKm, 1)} km</b></span>
                <ChevronRight size={16} />
              </button>
            </div>

            <div id="plot-tabs" className="tabs plot-tabs" role="tablist">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => go(key)}><Icon size={15} /> {t(label)}</button>
              ))}
            </div>

            {tab === "umumi" && (
              <>
                <section className="panel">
                  <div className="panel__head"><h3><Landmark size={18} /> Sahə haqqında</h3></div>
                  <div className="panel__body">
                    {p.description && <p style={{ marginBottom: 18 }}>{p.description}</p>}
                    <dl className="kv">
                      <dt>Torpaq tipi</dt><dd>{p.soilType ?? "yoxdur"}</dd>
                      <dt><Droplets size={14} /> Su mənbəyinə məsafə</dt><dd>{num(p.waterSourceKm, 1)} km</dd>
                      <dt><Route size={14} /> Asfalt yola məsafə</dt><dd>{num(p.roadKm, 1)} km</dd>
                      <dt>Suvarma sistemi</dt><dd>{yes(p.irrigationAvailable)}</dd>
                      <dt><Zap size={14} /> Elektrik xətti</dt><dd>{yes(p.electricityAvailable)}</dd>
                      <dt>Minadan təmizlənmə</dt><dd><MineTag label={p.mineClearance} /> {p.clearanceStartDate && <span className="muted"> {date(p.clearanceStartDate)} –</span>}{p.mineClearanceDate && <span className="muted"> {date(p.mineClearanceDate)}</span>}</dd>
                      <dt>İcarə müddəti</dt><dd>{p.leaseYears} il</dd>
                    </dl>
                    <hr className="divider" />
                    <h4 style={{ marginBottom: 6 }}>İstifadə şərtləri</h4>
                    <p className="muted">{p.usageTerms}</p>
                    {p.dataSource && <p className="faint" style={{ fontSize: 12.5, marginTop: 12 }}>Mənbə: {p.dataSource} Torpaq göstəriciləri, infrastruktur məsafələri və investisiya şərtləri nümunəvidir.</p>}
                  </div>
                </section>

                <section className="panel" style={{ overflow: "hidden" }}>
                  <div style={{ height: 360 }}>
                    <MapContainer center={[p.latitude, p.longitude]} zoom={13} scrollWheelZoom={false} style={{ height: "100%" }}>
                      <TileLayer attribution="Esri World Imagery" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
                      {p.boundaryGeoJson && <GeoJSON data={JSON.parse(p.boundaryGeoJson)} style={{ color: "#f5c542", weight: 3, fillColor: a.color, fillOpacity: 0.3 }} />}
                    </MapContainer>
                  </div>
                </section>
              </>
            )}
            {tab === "ai" && (rec ? <AiCard rec={rec} inputs={p} /> : <div className="panel"><Loading /></div>)}
            {tab === "iqlim" && <ClimatePanel plotId={p.id} />}
            {tab === "gelir" && <Calculator plot={p} />}
            {tab === "gunes" && <SolarPanel plot={p} />}
            {tab === "peyk" && <SatellitePanel plotId={p.id} />}
            {tab === "statistika" && <OfficialStats district={p.district} />}
          </div>

          <aside className="sticky stack" style={{ ["--gap" as string]: "18px" }}>
            <div className="panel panel--pad panel--raised">
              {comp && (
                <>
                  <div className="metric__label">Açıq müsabiqə</div>
                  <h3 style={{ margin: "8px 0 14px" }}>{comp.title}</h3>
                  <div className="callout callout--ok" style={{ marginBottom: 16 }}>
                    <CalendarClock />
                    <div>Son müraciət: <b>{date(comp.deadline)}</b><br /><span className="tabular" style={{ fontWeight: 700 }}>{countdown(comp.deadline)}</span> qalıb</div>
                  </div>
                </>
              )}
              {action}
              <div className="row" style={{ marginTop: 14 }}>
                <Link className="btn btn--sm btn--ghost" to={`/muqayise?ids=${p.id}`}><Scale size={14} /> Müqayisə</Link>
                <Link className="btn btn--sm btn--ghost" to="/xerite"><MapPin size={14} /> Xəritədə</Link>
                <Link className="btn btn--sm btn--ghost" to={`/xerite-3d?sahe=${p.id}`}><Box size={14} /> 3D bax</Link>
              </div>
              <Link className="btn btn--block passport-btn" to={`/sahe/${p.id}/pasport`}><FileDown size={16} /> {t("Sahə pasportu (PDF)")}</Link>
            </div>
            <div className="panel panel--pad">
              <h3 style={{ marginBottom: 10 }}><FileText size={17} style={{ verticalAlign: -3 }} /> Tələb olunan sənədlər</h3>
              <ul className="checklist">
                <li><Check color="#26775a" /> Biznes plan (PDF / DOCX)</li>
                <li><Check color="#26775a" /> Şəxsiyyət vəsiqəsi</li>
                <li><Check color="#26775a" /> Hüquqi şəxs: dövlət qeydiyyatı şəhadətnaməsi</li>
                <li><Check color="#9aa69f" /> Tövsiyə: maliyyə imkanını təsdiq edən sənəd</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
