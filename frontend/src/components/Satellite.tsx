import { useT } from "../lib/i18n";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Satellite as SatIcon } from "lucide-react";
import { Loading } from "./ui";
import { date } from "../lib/format";
import { useApi } from "../lib/hooks";
import type { SatelliteReport } from "../lib/types";

const TONE: Record<SatelliteReport["status"], string> = {
  ACTIVE: "ok", BASELINE: "info", PENDING: "info", WATCH: "warn", ALERT: "danger", NO_DATA: "muted",
};

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
const monthLabel = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`;

/**
 * Sentinel-2 NDVI over the plot boundary, month by month, with the latest true-colour and NDVI images.
 * For an awarded plot the award date is marked, and the backend flags a plot that stays bare after it.
 */
export function SatellitePanel({ plotId, compact = false }: { plotId: number; compact?: boolean }) {
  const { t } = useT();
  const { data, error, loading } = useApi<SatelliteReport>(`/api/v1/public/plots/${plotId}/satellite`);

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="row" style={{ ["--gap" as string]: "8px" }}><SatIcon size={18} /> {t("Peyk monitorinqi (NDVI)")}</h3>
        <span className="faint" style={{ fontSize: 12.5 }}>{t("Sentinel-2, son 13 ay")}</span>
      </div>
      <div className="panel__body">
        {loading && !data && <Loading label={t("Peyk görüntüləri təhlil edilir")} />}
        {error && <p className="faint">{error}</p>}
        {data && (
          <>
            <div className={`sat-banner sat-banner--${TONE[data.status]}`}>
              <b>{data.headline}</b>
              <span>{data.message}</span>
            </div>
            {data.series.length > 0 && (
              <div className={compact ? "sat-grid sat-grid--compact" : "sat-grid"}>
                <div>
                  <div style={{ height: 210 }}>
                    <ResponsiveContainer>
                      <LineChart data={data.series} margin={{ left: 0, right: 8, top: 22 }}>
                        <CartesianGrid vertical={false} stroke="#e5ebe7" />
                        <ReferenceArea y1={0.3} y2={1} fill="#1d7a3e" fillOpacity={0.06} />
                        <XAxis dataKey="date" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={11} />
                        <YAxis domain={[0, 0.8]} ticks={[0, 0.2, 0.4, 0.6, 0.8]} tickLine={false} axisLine={false} fontSize={11} width={30} />
                        <Tooltip labelFormatter={(l) => date(String(l))} formatter={(v: number, k) => (k === "ndvi" ? [v.toFixed(2), "NDVI (orta)"] : [v, k])} />
                        <ReferenceLine y={0.3} stroke="#1d7a3e" strokeDasharray="4 4" />
                        {data.awardDate && <ReferenceLine x={data.series.find((s) => s.date >= data.awardDate!)?.date} stroke="#c2410c" label={{ value: "qərar", position: "top", fontSize: 11, fill: "#c2410c" }} />}
                        <Line type="monotone" dataKey="ndvi" stroke="#1d5c43" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="faint" style={{ fontSize: 12 }}>Kəsik xətt: 0.3, yaşıl bitki örtüyü həddi. Hər ay üçün ən az buludlu görüntü götürülür.</p>
                </div>
                {data.images.trueColor && (
                  <div className="sat-images">
                    <figure><img src={data.images.trueColor} alt="Sahənin son peyk görüntüsü (təbii rənglər)" loading="lazy" /><figcaption>{t("Təbii rənglər")}</figcaption></figure>
                    <figure><img src={data.images.ndvi} alt="Sahənin NDVI xəritəsi" loading="lazy" /><figcaption>NDVI: <span className="sat-scale" /> {t("boş → yaşıl")}</figcaption></figure>
                    <p className="faint" style={{ gridColumn: "1 / -1", fontSize: 12 }}>Son görüntü: {date(data.series[data.series.length - 1].date)}, NDVI {data.latestNdvi?.toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}
            <p className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>Mənbə: {data.source}. Copernicus məlumatları açıq və pulsuzdur.</p>
          </>
        )}
      </div>
    </section>
  );
}
