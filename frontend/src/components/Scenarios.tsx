import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TriangleAlert } from "lucide-react";
import type { Economics } from "./Calculator";
import type { ClimateReport } from "./Climate";
import { money, num } from "../lib/format";
import { useApi } from "../lib/hooks";
import { useT } from "../lib/i18n";

const RAMP = [0, 0.3, 0.7, 1]; // perennials reach full yield in year 4 (same as the calculator)

export interface Outcome { annual: number; payback: number | null; total: number; series: number[] }

/** Cumulative cash over the lease: setup cost up front, then (yield × factor × price − annual cost) per hectare. */
export function simulate(e: Economics, area: number, years: number, yieldMul = 1, priceMul = 1): Outcome {
  let cum = -e.setup * area;
  const series = [Math.round(cum)];
  let payback: number | null = null;
  for (let y = 1; y <= years; y++) {
    const factor = e.perennial ? RAMP[Math.min(y - 1, RAMP.length - 1)] : 1;
    cum += area * (e.yieldT * yieldMul * factor * e.price * priceMul - e.annual);
    series.push(Math.round(cum));
    if (payback === null && cum >= 0) payback = y;
  }
  return { annual: Math.round(area * (e.yieldT * yieldMul * e.price * priceMul - e.annual)), payback, total: cum, series };
}

export interface Scenario { key: string; label: string; yieldMul: number; priceMul: number; color: string }
export const scenarios = (dy: number, dp: number): Scenario[] => [
  { key: "base", label: "Əsas plan", yieldMul: 1, priceMul: 1, color: "#1d5c43" },
  { key: "yield", label: `Məhsul −${dy}%`, yieldMul: 1 - dy / 100, priceMul: 1, color: "#d97706" },
  { key: "price", label: `Qiymət −${dp}%`, yieldMul: 1, priceMul: 1 - dp / 100, color: "#7c3aed" },
  { key: "bad", label: "Pis il (ikisi birlikdə)", yieldMul: 1 - dy / 100, priceMul: 1 - dp / 100, color: "#c92a2a" },
];

/** Yield or price at which a mature year only covers its running cost. */
export const breakEven = (e: Economics) => ({ yieldT: e.annual / e.price, price: e.annual / e.yieldT });

/**
 * Stress test of the investment calculator: the same project under a smaller harvest, a lower price and both at once,
 * with break-even yield and price. When the plot's ten-year climate shows a high risk for this crop, the bad-year
 * scenario is flagged, because that is the year the climate data says will come.
 */
export function Scenarios({ e, area, years, cropCode, plotId }: { e: Economics; area: number; years: number; cropCode: string; plotId: number }) {
  const { t } = useT();
  const [dy, setDy] = useState(20);
  const [dp, setDp] = useState(10);
  const climate = useApi<ClimateReport>(`/api/v1/public/plots/${plotId}/climate`).data;
  const climateRisk = climate?.crops.find((c) => c.code === cropCode);
  const risky = climateRisk && climateRisk.overall === "HIGH";

  const list = scenarios(dy, dp);
  const results = useMemo(() => list.map((s) => ({ s, o: simulate(e, area, years, s.yieldMul, s.priceMul) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [e.setup, e.annual, e.yieldT, e.price, e.perennial, area, years, dy, dp]);
  const base = results[0].o;
  const be = breakEven(e);
  const chart = base.series.map((_, y) => Object.fromEntries([["year", String(y)], ...results.map(({ s, o }) => [s.key, o.series[y]])]));

  return (
    <section className="panel">
      <div className="panel__head">
        <h3>{t("Ssenari müqayisəsi (stress test)")}</h3>
        <span className="faint" style={{ fontSize: 12.5 }}>{t("Pis il olsa, layihə nə qədər dözür?")}</span>
      </div>
      <div className="panel__body">
        <div className="scen-controls">
          <div className="field">
            <label htmlFor="scen-y">{t("Məhsul azalması")}: {dy}%</label>
            <input id="scen-y" className="range" type="range" min={5} max={50} step={5} value={dy} onChange={(ev) => setDy(Number(ev.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="scen-p">{t("Qiymət azalması")}: {dp}%</label>
            <input id="scen-p" className="range" type="range" min={5} max={40} step={5} value={dp} onChange={(ev) => setDp(Number(ev.target.value))} />
          </div>
        </div>

        {risky && (
          <div className="scen-alert">
            <TriangleAlert size={18} />
            <span>{t("İqlim riski tabında bu bitki üçün risk yüksəkdir")}: {climateRisk!.risks.filter((r) => r.level === "HIGH").map((r) => t(r.factor).toLowerCase()).join(", ")}. {t("«Pis il» ssenarisi bu sahə üçün real ehtimaldır.")}</span>
          </div>
        )}

        <div className="table-wrap">
          <table className="table scen-table">
            <thead><tr><th>{t("Ssenari")}</th><th className="num">{t("İllik xalis gəlir")}</th><th className="num">{t("Dəyişmə")}</th><th>{t("Geri qaytarılma")}</th><th className="num">{t("{n} ildə nəticə", { n: years })}</th></tr></thead>
            <tbody>
              {results.map(({ s, o }) => {
                const delta = base.annual ? Math.round(((o.annual - base.annual) / Math.abs(base.annual)) * 100) : 0;
                return (
                  <tr key={s.key} className={s.key === "bad" && risky ? "scen-row--risk" : ""}>
                    <td><i className="scen-dot" style={{ background: s.color }} /> {t(s.label)}</td>
                    <td className="num" style={{ color: o.annual < 0 ? "var(--danger)" : undefined }}>{money(o.annual)}</td>
                    <td className="num">{s.key === "base" ? "—" : `${delta}%`}</td>
                    <td>{o.payback ? t("{n}-ci il", { n: o.payback }) : <span style={{ color: "var(--danger)" }}>{t("{n} ildə qaytarılmır", { n: years })}</span>}</td>
                    <td className="num" style={{ color: o.total >= 0 ? "var(--forest-600)" : "var(--danger)" }}>{money(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="scen-grid">
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#e5ebe7" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} fontSize={11} width={48} />
                <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l) => t("{n}-ci il", { n: l })} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#9aa69f" />
                {list.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={t(s.label)} stroke={s.color} strokeWidth={s.key === "base" ? 2.5 : 1.8} dot={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="scen-be">
            <div className="label">{t("Zərərsizlik həddi")}</div>
            <p>{t("Məhsul")} <b>{num(be.yieldT, 2)} t/ha</b> {t("həddindən aşağı düşsə, il zərərlə bağlanır")} ({t("plan")}: {num(e.yieldT, 1)} t/ha, {t("ehtiyat")} {Math.max(0, Math.round((1 - be.yieldT / e.yieldT) * 100))}%).</p>
            <p>{t("Qiymət")} <b>{money(Math.round(be.price))}/t</b> {t("həddindən aşağı düşsə, il zərərlə bağlanır")} ({t("plan")}: {money(e.price)}/t).</p>
            <p className="faint" style={{ fontSize: 12.5 }}>{t("Xərclər məhsuldan asılı olmadığı üçün gəlir məhsuldan daha sürətlə düşür: bu, ehtiyat fondu və ya aqrar sığorta üçün əsasdır.")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
