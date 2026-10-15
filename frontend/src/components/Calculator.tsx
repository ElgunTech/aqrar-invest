import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Plot } from "../lib/types";
import { money, num } from "../lib/format";
import { useApi, useMeta } from "../lib/hooks";
import { Scenarios } from "./Scenarios";

/**
 * Per-hectare economics. These are illustrative, editable assumptions (not official statistics);
 * in production they would come from EKTİS / State Statistics data.
 */
export interface Economics { setup: number; annual: number; yieldT: number; price: number; perennial: boolean }
export const ECON: Record<string, Economics> = {
  cotton: { setup: 1500, annual: 1800, yieldT: 3.5, price: 1000, perennial: false },
  maize: { setup: 800, annual: 1200, yieldT: 7, price: 350, perennial: false },
  grapes: { setup: 12000, annual: 3000, yieldT: 12, price: 600, perennial: true },
  apple: { setup: 15000, annual: 4000, yieldT: 30, price: 450, perennial: true },
  pomegranate: { setup: 9000, annual: 2500, yieldT: 15, price: 700, perennial: true },
  chickpea: { setup: 500, annual: 700, yieldT: 1.8, price: 1100, perennial: false },
  lentil: { setup: 500, annual: 650, yieldT: 1.5, price: 1200, perennial: false },
  watermelon: { setup: 1500, annual: 2500, yieldT: 35, price: 200, perennial: false },
  muskmelon: { setup: 1500, annual: 2500, yieldT: 25, price: 300, perennial: false },
};
export const GENERIC: Economics = { setup: 1000, annual: 1500, yieldT: 5, price: 400, perennial: false };
const RAMP = [0, 0.3, 0.7, 1]; // perennial orchards and vineyards reach full yield in year 4

export function Calculator({ plot }: { plot: Plot }) {
  const meta = useMeta();
  const [crop, setCrop] = useState(plot.aiTopCrop?.code ?? "maize");
  const [area, setArea] = useState(Math.min(plot.areaHa, Math.max(5, Math.round(plot.areaHa / 2))));
  const official = useApi<{ tonsPerHa?: number; year?: number; fromYear?: number; years?: number; unit?: string; source?: string; note?: string }>(
    `/api/v1/public/official/yield?crop=${crop}&district=${encodeURIComponent(plot.district)}`).data;
  const officialYield = official?.tonsPerHa;
  const base = { ...(ECON[crop] ?? GENERIC), ...(officialYield ? { yieldT: officialYield } : {}) };
  const [over, setOver] = useState<Partial<Economics>>({});
  const e = { ...base, ...over };
  const years = Math.min(plot.leaseYears, 15);

  const { rows, payback, total } = useMemo(() => {
    let cum = -e.setup * area;
    const rows = [{ year: "0", value: Math.round(cum) }];
    let payback: number | null = null;
    for (let y = 1; y <= years; y++) {
      const factor = e.perennial ? RAMP[Math.min(y - 1, RAMP.length - 1)] : 1;
      cum += area * (e.yieldT * factor * e.price - e.annual);
      rows.push({ year: String(y), value: Math.round(cum) });
      if (payback === null && cum >= 0) payback = y;
    }
    return { rows, payback, total: cum };
  }, [e.setup, e.annual, e.yieldT, e.price, e.perennial, area, years]);

  const setCropAndReset = (c: string) => {
    setCrop(c);
    setOver({});
  };
  const field = (k: keyof Omit<Economics, "perennial">, label: string, step: number) => (
    <div className="field" style={{ marginBottom: 10 }}>
      <label htmlFor={`calc-${k}`}>{label}</label>
      <input id={`calc-${k}`} className="input tabular" type="number" min={0} step={step} value={e[k]} onChange={(ev) => setOver({ ...over, [k]: Number(ev.target.value) })} />
    </div>
  );

  return (
    <>
    <section className="panel">
      <div className="panel__head">
        <h3>İnvestisiya kalkulyatoru</h3>
        <span className="faint" style={{ fontSize: 12.5 }}>Nümunə fərziyyələr, redaktə edə bilərsiniz</span>
      </div>
      <div className="panel__body">
        <div className="grid grid--2" style={{ gap: 28 }}>
          <div>
            <div className="form-grid">
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="calc-crop">Bitki</label>
                <select id="calc-crop" className="select" value={crop} onChange={(ev) => setCropAndReset(ev.target.value)}>
                  {meta?.crops.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="calc-area">Əkin sahəsi: {num(area, 1)} ha</label>
                <input id="calc-area" className="range" type="range" min={1} max={plot.areaHa} step={1} value={area} onChange={(ev) => setArea(Number(ev.target.value))} style={{ marginTop: 12 }} />
              </div>
              {field("setup", "İlkin xərc, ₼/ha", 100)}
              {field("annual", "İllik xərc, ₼/ha", 100)}
              {field("yieldT", "Məhsuldarlıq, ton/ha", 0.5)}
              {field("price", "Satış qiyməti, ₼/ton", 10)}
            </div>
            {officialYield && over.yieldT === undefined && (
              <p style={{ fontSize: 12.5, color: "var(--forest-600)", marginBottom: 6 }}>
                Məhsuldarlıq rəsmi statistikadandır: {officialYield} t/ha, {official?.unit}, {official?.fromYear}–{official?.year}-ci illərin medianı ({official?.source}).{official?.note ? ` ${official.note}.` : ""}
              </p>
            )}
            {e.perennial && <p className="faint" style={{ fontSize: 12.5 }}>Çoxillik bitki: məhsul 2-ci ildə 30%, 3-cü ildə 70%, 4-cü ildən tam həcmdə.</p>}
          </div>
          <div>
            <dl className="kv" style={{ gridTemplateColumns: "1fr auto", marginBottom: 14 }}>
              <dt>İlkin investisiya</dt><dd className="tabular">{money(e.setup * area)}</dd>
              <dt>Tam gücdə illik gəlir</dt><dd className="tabular">{money(area * (e.yieldT * e.price - e.annual))}</dd>
              <dt>Geri qaytarılma</dt><dd>{payback ? `${payback}-ci il` : `${years} ildə qaytarılmır`}</dd>
              <dt>{years} ildə xalis nəticə</dt><dd className="tabular" style={{ color: total >= 0 ? "var(--forest-600)" : "var(--danger)" }}>{money(total)}</dd>
            </dl>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={rows} margin={{ left: 4, right: 4 }}>
                  <defs><linearGradient id="calc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d5c43" stopOpacity={0.3} /><stop offset="1" stopColor="#1d5c43" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#e5ebe7" />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} fontSize={11} width={44} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l) => `${l}-ci il`} />
                  <ReferenceLine y={0} stroke="#9aa69f" />
                  <Area type="monotone" dataKey="value" name="Yığılmış nəticə" stroke="#1d5c43" strokeWidth={2} fill="url(#calc-g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {e.setup * area < plot.minInvestment && (
              <p className="faint" style={{ fontSize: 12.5 }}>Qeyd: müsabiqə şərtinə görə minimum investisiya {money(plot.minInvestment)} təşkil edir.</p>
            )}
          </div>
        </div>
      </div>
    </section>
    <Scenarios e={e} area={area} years={years} cropCode={crop} plotId={plot.id} />
    </>
  );
}
