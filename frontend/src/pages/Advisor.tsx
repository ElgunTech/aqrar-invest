import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Brain, Check, FlaskConical, Target, X } from "lucide-react";
import { Callout, Empty, Loading, Meter, MineTag, Tag } from "../components/ui";
import { api } from "../lib/api";
import { ACTIVITY, FEATURE_LABELS } from "../lib/domain";
import { money, num, pct, pct1 } from "../lib/format";
import { useApi, useDebounced, useDocumentTitle, useMeta } from "../lib/hooks";
import type { CropRecommendation, MatchResult, ModelInfo, SoilClimate } from "../lib/types";

const PRESETS: { name: string; v: SoilClimate }[] = [
  { name: "Ağdam düzənliyi", v: { nitrogen: 118, phosphorus: 46, potassium: 20, temperature: 24.2, humidity: 79, ph: 6.9, rainfall: 79 } },
  { name: "Füzuli dağətəyi", v: { nitrogen: 24, phosphorus: 131, potassium: 199, temperature: 23.6, humidity: 81, ph: 6.0, rainfall: 69 } },
  { name: "Şuşa yaylası", v: { nitrogen: 21, phosphorus: 133, potassium: 200, temperature: 22.4, humidity: 92, ph: 5.9, rainfall: 112 } },
  { name: "Quru dəmyə", v: { nitrogen: 41, phosphorus: 68, potassium: 80, temperature: 19, humidity: 17, ph: 7.3, rainfall: 80 } },
];

const SLIDERS: { key: keyof SoilClimate; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "nitrogen", label: "Azot (N)", min: 0, max: 140, step: 1, unit: "kq/ha" },
  { key: "phosphorus", label: "Fosfor (P)", min: 5, max: 145, step: 1, unit: "kq/ha" },
  { key: "potassium", label: "Kalium (K)", min: 5, max: 205, step: 1, unit: "kq/ha" },
  { key: "temperature", label: "Orta temperatur", min: 8, max: 43, step: 0.5, unit: "°C" },
  { key: "humidity", label: "Nisbi rütubət", min: 14, max: 100, step: 1, unit: "%" },
  { key: "ph", label: "Torpağın pH-ı", min: 3.5, max: 9.9, step: 0.1, unit: "" },
  { key: "rainfall", label: "Yağıntı", min: 20, max: 300, step: 1, unit: "mm" },
];

function SoilLab() {
  const [v, setV] = useState<SoilClimate>(PRESETS[0].v);
  const debounced = useDebounced(v, 120);
  const [rec, setRec] = useState<CropRecommendation | null>(null);

  useEffect(() => {
    api<CropRecommendation>("/api/v1/public/ai/recommend", { method: "POST", body: debounced }).then(setRec).catch(() => {});
  }, [debounced]);

  return (
    <section className="panel">
      <div className="panel__head">
        <h3><FlaskConical size={18} /> Torpaq laboratoriyası: göstəriciləri dəyişin, AI canlı cavab versin</h3>
      </div>
      <div className="panel__body">
        <div className="row" style={{ marginBottom: 18 }}>
          <span className="muted" style={{ fontSize: 13 }}>Hazır profillər:</span>
          {PRESETS.map((p) => <button key={p.name} className="btn btn--sm btn--ghost" onClick={() => setV(p.v)}>{p.name}</button>)}
        </div>
        <div className="grid grid--2" style={{ gap: 32 }}>
          <div>
            {SLIDERS.map((s) => (
              <div key={s.key} className="field" style={{ marginBottom: 12 }}>
                <div className="row row--between">
                  <label htmlFor={`s-${s.key}`}>{s.label}</label>
                  <span className="tabular" style={{ fontWeight: 650, fontSize: 13.5 }}>{num(v[s.key], s.step < 1 ? 1 : 0)} {s.unit}</span>
                </div>
                <input id={`s-${s.key}`} className="range" type="range" min={s.min} max={s.max} step={s.step} value={v[s.key]}
                  onChange={(e) => setV({ ...v, [s.key]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <div>
            {!rec ? <Loading /> : (
              <div aria-live="polite">
                <div className="row row--between" style={{ marginBottom: 6 }}>
                  <span className="metric__label">Tövsiyə</span>
                  <span className="model-badge"><span className="dot" />{rec.engine === "ONNX" ? "ONNX · canlı" : "Fallback"}</span>
                </div>
                {rec.recommendations.map((c, i) => (
                  <div className="crop" key={c.code}>
                    <span className="crop__name" style={i === 0 ? { fontSize: 18, fontFamily: "var(--font-display)" } : undefined}>{c.name}</span>
                    <span className="crop__pct">{pct(c.probability)}</span>
                    <Meter value={c.probability} gold={i === 0} />
                  </div>
                ))}
                <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{rec.explanation}</p>
                {rec.rawTop.length > 0 && (
                  <details style={{ marginTop: 12, fontSize: 13 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600 }}>Modelin xam çıxışı (filtrdən əvvəl)</summary>
                    <ul className="reasons" style={{ marginTop: 8 }}>
                      {rec.rawTop.map((c) => (
                        <li key={c.code} className={c.regionSuitable ? "pos" : "neg"}>
                          {c.regionSuitable ? <Check /> : <X />} {c.name} · {pct(c.probability)} {!c.regionSuitable && <span className="faint">(regiona uyğun deyil)</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Matcher() {
  const meta = useMeta();
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const body = {
        activity: f.get("activity") || null,
        budget: f.get("budget") ? Number(f.get("budget")) : null,
        minArea: f.get("minArea") ? Number(f.get("minArea")) : null,
        maxArea: f.get("maxArea") ? Number(f.get("maxArea")) : null,
        districts: f.getAll("districts").map(String),
        desiredCrop: f.get("crop") || null,
        needIrrigation: f.get("irrigation") === "on",
        experienceYears: f.get("experience") ? Number(f.get("experience")) : null,
      };
      setResults(await api<MatchResult[]>("/api/v1/public/match", { method: "POST", body }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="layout-side" style={{ gridTemplateColumns: "360px minmax(0,1fr)" }}>
      <form className="panel panel--pad sticky" onSubmit={submit}>
        <h3 style={{ marginBottom: 4 }}><Target size={18} style={{ verticalAlign: -3 }} /> Mənə hansı sahə uyğundur?</h3>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>Planınızı yazın, sistem bütün sahələri 100 ballıq şkala ilə qiymətləndirib səbəbləri ilə sıralasın.</p>
        <div className="field">
          <label htmlFor="m-act">Fəaliyyət</label>
          <select id="m-act" name="activity" className="select" defaultValue="HORTICULTURE">
            <option value="">Fərq etməz</option>
            {meta?.activityTypes.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-budget">Büdcə (AZN)</label>
          <input id="m-budget" name="budget" className="input" type="number" min={0} step={10000} defaultValue={500000} />
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="m-min">Min. sahə (ha)</label><input id="m-min" name="minArea" className="input" type="number" min={0} /></div>
          <div className="field"><label htmlFor="m-max">Maks. sahə (ha)</label><input id="m-max" name="maxArea" className="input" type="number" min={0} /></div>
        </div>
        <div className="field">
          <label htmlFor="m-crop">Əkmək istədiyiniz bitki (AI yoxlayacaq)</label>
          <select id="m-crop" name="crop" className="select" defaultValue="apple">
            <option value="">Seçilməyib</option>
            {meta?.crops.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">Üstünlük verilən rayonlar</span>
          <div className="row" style={{ ["--gap" as string]: "6px 14px" }}>
            {meta?.districts.map((d) => <label key={d} className="check" style={{ fontSize: 13.5 }}><input type="checkbox" name="districts" value={d} /> {d}</label>)}
          </div>
        </div>
        <div className="field"><label className="check"><input type="checkbox" name="irrigation" defaultChecked /> Suvarma vacibdir</label></div>
        <button className="btn btn--block btn--lg" disabled={busy}>{busy ? "Hesablanır…" : "Uyğun sahələri tap"}</button>
      </form>

      <div className="stack" style={{ ["--gap" as string]: "14px" }}>
        {!results && <div className="panel"><Empty title="Nəticələr burada görünəcək" icon={<Target aria-hidden />}>Soldakı formu doldurun.</Empty></div>}
        {results?.map((r, i) => {
          const a = ACTIVITY[r.plot.activityType.code];
          const Icon = a.icon;
          return (
            <article key={r.plot.id} className="panel panel--pad rise" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="row row--top" style={{ ["--gap" as string]: "18px" }}>
                <div style={{ textAlign: "center", flex: "none", width: 72 }}>
                  <div style={{ font: "800 30px/1 var(--font-display)", color: r.score >= 80 ? "var(--forest-600)" : r.score >= 60 ? "var(--amber-600)" : "var(--ink-faint)" }}>{r.score}</div>
                  <div className="faint" style={{ fontSize: 11 }}>/ 100</div>
                  {i === 0 && <div style={{ marginTop: 6 }}><Tag tone="gold">1-ci</Tag></div>}
                </div>
                <div className="grow">
                  <div className="row" style={{ ["--gap" as string]: "8px", marginBottom: 4 }}>
                    <Icon size={16} color={a.color} />
                    <Link to={`/sahe/${r.plot.id}`} style={{ font: "650 16px var(--font-display)", color: "var(--ink)" }}>{r.plot.title}</Link>
                    <MineTag label={r.plot.mineClearance} />
                  </div>
                  <div className="faint" style={{ fontSize: 13, marginBottom: 10 }}>{r.plot.district} · {num(r.plot.areaHa, 1)} ha · min. {money(r.plot.minInvestment)}</div>
                  <ul className="reasons" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                    {r.reasons.map((x) => <li key={x.text} className={x.positive ? "pos" : "neg"}>{x.positive ? <Check /> : <X />}{x.text}</li>)}
                  </ul>
                </div>
                <Link className="btn btn--sm btn--ghost" to={`/sahe/${r.plot.id}`}>Bax <ArrowRight size={14} /></Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ModelCard() {
  const { data: m } = useApi<ModelInfo>("/api/v1/public/ai/model");
  if (!m) return <Loading />;
  if (!m.modelLoaded) return <Callout tone="warn">Öyrədilmiş model hələ quraşdırılmayıb, müvəqqəti alqoritm işləyir.</Callout>;
  const imp = Object.entries(m.featureImportance ?? {}).map(([k, v]) => ({ name: FEATURE_LABELS[k] ?? k, value: Math.round(v * 1000) / 10 }));
  const cmp = Object.entries(m.modelComparison ?? {}).map(([k, v]) => ({ name: k, value: Math.round(v * 1000) / 10 })).sort((a, b) => b.value - a.value);
  return (
    <div className="stack" style={{ ["--gap" as string]: "22px" }}>
      <div className="grid grid--4">
        <div className="panel metric"><div className="metric__label">Model</div><div className="metric__value" style={{ fontSize: 22 }}>{m.modelName}</div><div className="metric__hint">versiya {m.version}</div></div>
        <div className="panel metric"><div className="metric__label">Test dəqiqliyi</div><div className="metric__value">{pct1(m.metrics?.test_accuracy)}</div><div className="metric__hint">440 nümunəlik test dəsti</div></div>
        <div className="panel metric"><div className="metric__label">5-fold CV</div><div className="metric__value">{pct1(m.metrics?.cv_accuracy)}</div><div className="metric__hint">Macro F1 {pct1(m.metrics?.test_macro_f1)}</div></div>
        <div className="panel metric"><div className="metric__label">Siniflər</div><div className="metric__value">{m.classes}</div><div className="metric__hint">bitki növü</div></div>
      </div>
      <div className="grid grid--2">
        <section className="panel">
          <div className="panel__head"><h3>6 alqoritmin müqayisəsi (CV dəqiqliyi, %)</h3></div>
          <div className="panel__body" style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={cmp} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid horizontal={false} stroke="#e5ebe7" />
                <XAxis type="number" domain={[90, 100]} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={110} />
                <Tooltip formatter={(v: number) => v + "%"} />
                <Bar dataKey="value" name="CV dəqiqliyi" fill="#1d5c43" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel__head"><h3>Göstəricilərin əhəmiyyəti (permutation importance)</h3></div>
          <div className="panel__body" style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={imp} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid horizontal={false} stroke="#e5ebe7" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={100} />
                <Tooltip />
                <Bar dataKey="value" name="Əhəmiyyət" fill="#d9a23a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <Callout tone="info">
        <b>Məlumat mənbəyi:</b> {m.dataset}. Dataset Hindistan məlumatlarına əsaslanır, ona görə portal tropik bitkiləri regional iqlim filtri ilə çıxarır.
        Növbəti mərhələdə model EKTİS-in real torpaq analizləri və məhsuldarlıq məlumatları ilə yenidən öyrədiləcək. Öyrətmə boru xətti hazırdır.
      </Callout>
    </div>
  );
}

export default function Advisor() {
  useDocumentTitle("AI məsləhətçi");
  const [tab, setTab] = useState<"match" | "lab" | "model">("match");
  return (
    <>
      <section className="band">
        <div className="wrap">
          <h1>AI məsləhətçi</h1>
          <p>Kaggle-da öyrədilmiş bitki tövsiyəsi modeli portalın içində işləyir: sahəni seçməyə kömək edir, torpağı analiz edir və hər qərarın səbəbini göstərir.</p>
        </div>
      </section>
      <div className="wrap page">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "match"} onClick={() => setTab("match")}><Target size={16} /> Uyğunluq testi</button>
          <button role="tab" aria-selected={tab === "lab"} onClick={() => setTab("lab")}><FlaskConical size={16} /> Torpaq laboratoriyası</button>
          <button role="tab" aria-selected={tab === "model"} onClick={() => setTab("model")}><Brain size={16} /> Model kartı</button>
        </div>
        {tab === "match" && <Matcher />}
        {tab === "lab" && <SoilLab />}
        {tab === "model" && <ModelCard />}
      </div>
    </>
  );
}
