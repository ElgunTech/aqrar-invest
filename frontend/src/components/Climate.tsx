import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudSun } from "lucide-react";
import { Loading } from "./ui";
import { num } from "../lib/format";
import { useApi } from "../lib/hooks";
import { useT } from "../lib/i18n";

export type Level = "LOW" | "MEDIUM" | "HIGH";
export interface ClimateReport {
  period: string;
  elevation: number;
  indicators: {
    frostDays: number; lateFrostDays: number; yearsWithLateFrost: number; coldestNight: number; avgYearlyMin: number;
    hotDays35: number; annualPrecip: number; seasonPrecip: number; driestSummer: number; gdd10: number;
  };
  months: { month: number; tmax: number; tmin: number; precip: number }[];
  crops: { code: string; name: string; overall: Level; irrigationNeedMm: number; risks: { factor: string; level: Level; note: string }[] }[];
  source: string;
  note: string;
}

export const LEVEL: Record<Level, { label: string; cls: string }> = {
  LOW: { label: "Aşağı risk", cls: "ok" },
  MEDIUM: { label: "Orta risk", cls: "warn" },
  HIGH: { label: "Yüksək risk", cls: "danger" },
};
const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

/** Ten-year climate of the plot (ERA5) and the risk it poses to the AI's top crops. */
export function ClimatePanel({ plotId }: { plotId: number }) {
  const { t } = useT();
  const { data, error, loading } = useApi<ClimateReport>(`/api/v1/public/plots/${plotId}/climate`);
  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="row" style={{ ["--gap" as string]: "8px" }}><CloudSun size={18} /> {t("İqlim riski")}</h3>
        <span className="faint" style={{ fontSize: 12.5 }}>ERA5 · {data?.period ?? "2015–2024"}</span>
      </div>
      <div className="panel__body">
        {loading && !data && <Loading label={t("10 illik iqlim məlumatı təhlil edilir")} />}
        {error && <p className="faint">{error}</p>}
        {data && <ClimateBody data={data} />}
      </div>
    </section>
  );
}

export function ClimateBody({ data, print = false }: { data: ClimateReport; print?: boolean }) {
  const { t } = useT();
  const i = data.indicators;
  const tiles: [string, string, string][] = [
    [t("Şaxtalı günlər"), num(i.frostDays, 0), t("ildə, gecə 0°C-dən aşağı")],
    [t("Gec yaz şaxtası"), `${i.yearsWithLateFrost} / 10`, t("ildə aprel–may ortası şaxta")],
    [t("Ən soyuq gecə"), `${num(i.coldestNight, 1)}°C`, t("10 il ərzində")],
    [t("İsti günlər"), num(i.hotDays35, 0), t("ildə, 35°C-dən isti")],
    [t("Yağıntı"), `${num(i.annualPrecip)} mm`, `${t("ildə")}; ${t("vegetasiya dövründə")} ${num(i.seasonPrecip)} mm`],
    [t("İstilik cəmi"), num(i.gdd10), t("°C·gün, 10°C-dən yuxarı")],
  ];
  return (
    <>
      <div className="climate-tiles">
        {tiles.map(([k, v, h]) => <div key={k}><span>{k}</span><b>{v}</b><small>{h}</small></div>)}
      </div>
      {!print && (
        <div style={{ height: 220, margin: "18px 0 6px" }}>
          <ResponsiveContainer>
            <ComposedChart data={data.months.map((m) => ({ ...m, name: MONTHS[m.month - 1] }))} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#e5ebe7" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis yAxisId="t" tickLine={false} axisLine={false} fontSize={11} width={30} unit="°" />
              <YAxis yAxisId="p" orientation="right" tickLine={false} axisLine={false} fontSize={11} width={34} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="p" dataKey="precip" name={t("Yağıntı, mm")} fill="#9cc3e6" radius={[3, 3, 0, 0]} />
              <Line yAxisId="t" type="monotone" dataKey="tmax" name={t("Gündüz, °C")} stroke="#d9480f" strokeWidth={2} dot={false} />
              <Line yAxisId="t" type="monotone" dataKey="tmin" name={t("Gecə, °C")} stroke="#1c7ed6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <h4 style={{ margin: "16px 0 8px" }}>{t("AI-nin tövsiyə etdiyi bitkilər üçün iqlim riski")}</h4>
      <div className="climate-crops">
        {data.crops.map((c) => (
          <div key={c.code} className={`climate-crop climate-crop--${LEVEL[c.overall].cls}`}>
            <div className="climate-crop__head"><b>{t(c.name)}</b><span>{t(LEVEL[c.overall].label)}</span></div>
            <ul>
              {c.risks.map((r) => (
                <li key={r.factor}><i className={`lvl lvl--${LEVEL[r.level].cls}`} /> <b>{t(r.factor)}</b> <span className="faint">{r.note}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>{t("Mənbə")}: {data.source}. {data.note} {t("Hündürlük")}: {num(data.elevation)} m.</p>
    </>
  );
}
