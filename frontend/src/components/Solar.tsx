import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sun } from "lucide-react";
import { Loading } from "./ui";
import { ECON, GENERIC } from "./Calculator";
import { money, num } from "../lib/format";
import { useApi } from "../lib/hooks";
import { useT } from "../lib/i18n";
import type { Plot } from "../lib/types";

interface Criterion { name: string; points: number; max: number; note: string }
interface SolarReport {
  verdict: string;
  verdictCode: "HIGH" | "GOOD" | "LIMITED" | "BLOCKED";
  score: number;
  criteria: Criterion[];
  kwhPerKwp: number;
  irradiation: number;
  optimalTilt: number;
  monthlyKwhPerKwp: number[];
  rules: { sellTariff: number; agriTariff: number; activeConsumerKw: number; tariffSource: string; rulesSource: string };
  assumptions: { capexSmallPerKwp: number; capexLargePerKwp: number; omShare: number; degradation: number; lifetimeYears: number; agrivoltaicKwpPerHa: number; selfConsumption: number; gridCo2KgPerKwh: number };
  notes: string[];
  source: string;
}

const TONE = { HIGH: "ok", GOOD: "ok", LIMITED: "warn", BLOCKED: "danger" } as const;
const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
/** Yield lost under agrivoltaic panels on the covered share of the plot (partial shading). */
const SHADE_LOSS = 0.15;

/**
 * Solar suitability of a plot and what a PV plant adds to the farm's income, using the official purchase and
 * agricultural tariffs. Two set-ups: an "active consumer" plant up to 150 kW for the farm's own needs, and an
 * agrivoltaic plant on part of the plot that sells to the grid while farming continues underneath.
 */
export function SolarPanel({ plot }: { plot: Plot }) {
  const { t } = useT();
  const { data, error, loading } = useApi<SolarReport>(`/api/v1/public/plots/${plot.id}/solar`);
  const [mode, setMode] = useState<"active" | "agri">("active");
  const [kw, setKw] = useState(150);
  const [share, setShare] = useState(10);
  const [capexOverride, setCapex] = useState<number | null>(null);

  const calc = useMemo(() => {
    if (!data) return null;
    const a = data.assumptions, r = data.rules;
    const capacity = mode === "active" ? kw : Math.round(plot.areaHa * (share / 100) * a.agrivoltaicKwpPerHa);
    const perKwp = capexOverride ?? (mode === "active" ? a.capexSmallPerKwp : a.capexLargePerKwp);
    const capex = capacity * perKwp;
    const energy = capacity * data.kwhPerKwp;
    const value = mode === "active"
      ? energy * a.selfConsumption * r.agriTariff + energy * (1 - a.selfConsumption) * r.sellTariff
      : energy * r.sellTariff;
    const om = capex * a.omShare;
    let cum = -capex, payback: number | null = null;
    for (let y = 1; y <= a.lifetimeYears; y++) {
      cum += value * Math.pow(1 - a.degradation, y - 1) - om;
      if (payback === null && cum >= 0) payback = y;
    }
    // farm income from the AI-recommended crop at full yield, as in the investment calculator
    const e = ECON[plot.aiTopCrop?.code ?? ""] ?? GENERIC;
    const agriPerHa = e.yieldT * e.price - e.annual;
    const agri = plot.areaHa * agriPerHa - (mode === "agri" ? plot.areaHa * (share / 100) * e.yieldT * e.price * SHADE_LOSS : 0);
    const solarNet = value - om;
    return { capacity, perKwp, capex, energy, value, om, solarNet, payback, total25: cum, agri, co2: energy * a.gridCo2KgPerKwh / 1000 };
  }, [data, mode, kw, share, capexOverride, plot]);

  const tone = data ? TONE[data.verdictCode] : "info";
  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="row" style={{ ["--gap" as string]: "8px" }}><Sun size={18} /> {t("Günəş enerjisi")}</h3>
        <span className="faint" style={{ fontSize: 12.5 }}>PVGIS · {t("Tarif Şurası")}</span>
      </div>
      <div className="panel__body">
        {loading && !data && <Loading label={t("Günəş potensialı hesablanır")} />}
        {error && <p className="faint">{error}</p>}
        {data && calc && (
          <>
            <div className={`sat-banner sat-banner--${tone}`}>
              <b>{t(data.verdict)} · {data.score}/100</b>
              <span>{num(data.kwhPerKwp)} kWh/kWp {t("ildə")} · {t("radiasiya")} {num(data.irradiation)} kWh/m² · {t("optimal bucaq")} {data.optimalTilt}°</span>
            </div>

            <div className="sat-grid">
              <table className="table table--kv solar-criteria">
                <tbody>
                  {data.criteria.map((c) => (
                    <tr key={c.name}>
                      <td><b>{t(c.name)}</b><div className="faint" style={{ fontSize: 12 }}>{c.note}</div></td>
                      <td className="num"><span className="solar-meter"><i style={{ width: `${(c.points / c.max) * 100}%` }} /></span>{c.points}/{c.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <div className="label" style={{ marginBottom: 4 }}>{t("Aylıq istehsal")}, MWh ({num(calc.capacity)} kW)</div>
                <div style={{ height: 170 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.monthlyKwhPerKwp.map((v, i) => ({ m: MONTHS[i], v: Math.round((v * calc.capacity) / 100) / 10 }))} margin={{ left: 0, right: 4 }}>
                      <CartesianGrid vertical={false} stroke="#e5ebe7" />
                      <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={34} />
                      <Tooltip formatter={(v: number) => [`${v} MWh`, t("İstehsal")]} />
                      <Bar dataKey="v" fill="#d99a06" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {data.verdictCode !== "BLOCKED" && (
              <>
                <div className="tabs" role="tablist" style={{ marginTop: 18, marginBottom: 14 }}>
                  <button role="tab" aria-selected={mode === "active"} onClick={() => { setMode("active"); setCapex(null); }}>{t("Aktiv istehlakçı (≤150 kW)")}</button>
                  <button role="tab" aria-selected={mode === "agri"} onClick={() => { setMode("agri"); setCapex(null); }}>{t("Aqrovoltaik stansiya")}</button>
                </div>
                <div className="grid grid--2" style={{ gap: 24 }}>
                  <div>
                    {mode === "active" ? (
                      <div className="field">
                        <label htmlFor="sol-kw">{t("Qurğunun gücü")}: {kw} kW</label>
                        <input id="sol-kw" className="range" type="range" min={10} max={data.rules.activeConsumerKw} step={10} value={kw} onChange={(e) => setKw(Number(e.target.value))} />
                        <p className="faint" style={{ fontSize: 12.5 }}>{t("Enerjinin {p}%-i təsərrüfatın öz ehtiyacına gedir (10.6 qəpik qənaət), qalanı Azərişıq şəbəkəsinə satılır (8.5 qəpik).", { p: Math.round(data.assumptions.selfConsumption * 100) })}</p>
                      </div>
                    ) : (
                      <div className="field">
                        <label htmlFor="sol-share">{t("Panellərin örtdüyü hissə")}: {share}% · {num(plot.areaHa * share / 100, 1)} ha</label>
                        <input id="sol-share" className="range" type="range" min={2} max={30} step={1} value={share} onChange={(e) => setShare(Number(e.target.value))} />
                        <p className="faint" style={{ fontSize: 12.5 }}>{t("Panellər hündür konstruksiyada, altında əkin davam edir. Örtülən hissədə məhsuldarlıq təxminən 15% azalır. Bütün enerji şəbəkəyə satılır.")}</p>
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="sol-capex">{t("Quraşdırma xərci, ₼/kWp")}</label>
                      <input id="sol-capex" className="input tabular" type="number" min={300} step={50} value={calc.perKwp} onChange={(e) => setCapex(Number(e.target.value))} />
                    </div>
                    <dl className="kv" style={{ gridTemplateColumns: "1fr auto" }}>
                      <dt>{t("Güc")}</dt><dd>{num(calc.capacity)} kW</dd>
                      <dt>{t("İllik istehsal")}</dt><dd>{num(calc.energy / 1000)} MWh</dd>
                      <dt>{t("İlkin investisiya")}</dt><dd>{money(calc.capex)}</dd>
                      <dt>{t("İllik gəlir və qənaət")}</dt><dd>{money(calc.value)}</dd>
                      <dt>{t("İstismar xərci")}</dt><dd>{money(calc.om)}</dd>
                      <dt>{t("Geri qaytarılma")}</dt><dd>{calc.payback ? t("{n}-ci il", { n: calc.payback }) : t("25 ildə qaytarılmır")}</dd>
                      <dt>{t("25 ildə xalis nəticə")}</dt><dd style={{ color: calc.total25 >= 0 ? "var(--forest-600)" : "var(--danger)" }}>{money(calc.total25)}</dd>
                      <dt>{t("CO₂ azalması")}</dt><dd>{num(calc.co2)} {t("ton/il")}</dd>
                    </dl>
                    {mode === "agri" && calc.capacity > data.rules.activeConsumerKw && (
                      <p className="faint" style={{ fontSize: 12.5 }}>{t("Güc 150 kW-dan çoxdur: tarif auksionla müəyyən ediləcək, hesabda 8.5 qəpik istinad götürülüb.")}</p>
                    )}
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>{t("Sahənin illik gəlirinə təsiri")}</div>
                    <table className="table table--kv">
                      <tbody>
                        <tr><td>{t("Kənd təsərrüfatı (xalis)")}{plot.aiTopCrop ? `, ${t(plot.aiTopCrop.name)}` : ""}</td><td className="num">{money(calc.agri)}</td></tr>
                        <tr><td>{t("Günəş enerjisi (xalis)")}</td><td className="num">+ {money(calc.solarNet)}</td></tr>
                        <tr><td><b>{t("Cəmi")}</b></td><td className="num"><b>{money(calc.agri + calc.solarNet)}</b></td></tr>
                      </tbody>
                    </table>
                    <div className="solar-split" aria-hidden>
                      <span style={{ flexGrow: Math.max(calc.agri, 0) }} />
                      <span className="solar-split__sun" style={{ flexGrow: Math.max(calc.solarNet, 0) }} />
                    </div>
                    <p style={{ fontSize: 13.5, marginTop: 8 }}>
                      {calc.agri > 0
                        ? t("Günəş enerjisi sahənin illik xalis gəlirini {p}% artırır.", { p: Math.round((calc.solarNet / calc.agri) * 100) })
                        : t("Günəş enerjisi sahəyə sabit, mövsümdən asılı olmayan gəlir əlavə edir.")}
                    </p>
                  </div>
                </div>
              </>
            )}

            <ul className="solar-notes">
              {data.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
            <p className="faint" style={{ fontSize: 11.5 }}>
              {t("Mənbələr")}: {data.source}; {data.rules.tariffSource}; {data.rules.rulesSource}.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
