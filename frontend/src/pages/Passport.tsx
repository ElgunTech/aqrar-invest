import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { Loading } from "../components/ui";
import { ClimateBody, type ClimateReport } from "../components/Climate";
import { ECON, GENERIC } from "../components/Calculator";
import { breakEven, scenarios, simulate } from "../components/Scenarios";
import { date, dateTime, money, num, pct1, fit } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { CropRecommendation, OfficialIndicator, Plot, SatelliteReport } from "../lib/types";

interface SolarSummary {
  verdict: string; score: number; kwhPerKwp: number; optimalTilt: number;
  rules: { sellTariff: number; agriTariff: number; activeConsumerKw: number; tariffSource: string };
}

/**
 * Plot passport: one printable due-diligence document that gathers everything the portal knows about a plot —
 * official demining record, AI crop advice, ten-year climate risk, satellite history, solar potential and district
 * statistics. "Save as PDF" in the print dialog produces the file; the QR code opens the live plot page.
 */
export default function Passport() {
  const { id } = useParams();
  const { data: p } = useApi<Plot>(`/api/v1/public/plots/${id}`);
  const { data: rec, error: recErr } = useApi<CropRecommendation>(`/api/v1/public/plots/${id}/recommendation`);
  const { data: climate, error: climateErr } = useApi<ClimateReport>(`/api/v1/public/plots/${id}/climate`);
  const { data: sat, error: satErr } = useApi<SatelliteReport>(`/api/v1/public/plots/${id}/satellite`);
  const { data: solar, error: solarErr } = useApi<SolarSummary>(`/api/v1/public/plots/${id}/solar`);
  const { data: stats } = useApi<OfficialIndicator[]>(p ? `/api/v1/public/official/district/${encodeURIComponent(p.district)}` : null);
  const [qr, setQr] = useState<string | null>(null);
  const url = `${location.origin}/sahe/${id}`;
  useDocumentTitle(p ? `Sahə pasportu ${p.code}` : "Sahə pasportu");

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 220, color: { dark: "#0b2219", light: "#ffffff" } }).then(setQr);
  }, [url]);

  if (!p) return <Loading />;
  // every section either loaded or failed: an unavailable external service must not block printing
  const ready = (rec || recErr) && (climate || climateErr) && (sat || satErr) && (solar || solarErr);
  const unavailable = <p className="faint">Xidmət hazırda cavab vermir; bu bölmə sahənin canlı səhifəsində yenilənir.</p>;

  return (
    <div className="receipt-page">
      <div className="receipt-actions no-print">
        <Link className="btn btn--ghost" to={`/sahe/${p.id}`}><ArrowLeft size={16} /> Sahəyə qayıt</Link>
        <button className="btn" onClick={() => print()} disabled={!ready}><Printer size={16} /> {ready ? "Çap et / PDF kimi saxla" : "Məlumatlar yüklənir…"}</button>
      </div>
      <article className="receipt passport">
        <div className="flag-strip" />
        <header className="receipt__head">
          <div>
            <div className="receipt__org">Aqrar İnvest · İnvestisiya müsabiqəsi portalı</div>
            <h1>Sahə pasportu</h1>
            <div className="passport__title">{p.title} <span className="mono">{p.code}</span></div>
          </div>
          {qr && <img src={qr} alt={`Sahənin canlı səhifəsi: ${url}`} width={110} height={110} />}
        </header>

        <h2>1. Əsas məlumatlar</h2>
        <table className="receipt__table">
          <tbody>
            <tr><th>Yerləşmə</th><td>{p.district} rayonu, {p.village} · {num(p.latitude, 4)}, {num(p.longitude, 4)}</td></tr>
            <tr><th>Ərazi və təyinat</th><td>{num(p.areaHa, 1)} ha · {p.activityType.label}</td></tr>
            <tr><th>Minatəmizləmə</th><td>{p.mineClearance.label}{p.anamaRef ? ` · ANAMA ${p.anamaRef}` : ""}{p.mineClearanceDate ? ` · ${date(p.mineClearanceDate)}` : ""}</td></tr>
            <tr><th>İcarə və investisiya</th><td>{p.leaseYears} il · minimum {money(p.minInvestment)}</td></tr>
            <tr><th>İnfrastruktur</th><td>Su {num(p.waterSourceKm, 1)} km · yol {num(p.roadKm, 1)} km · suvarma {p.irrigationAvailable ? "var" : "yoxdur"} · elektrik {p.electricityAvailable ? "var" : "yoxdur"}</td></tr>
            <tr><th>Müsabiqə</th><td>{p.openCompetition ? `${p.openCompetition.title} · son müraciət ${date(p.openCompetition.deadline)}` : p.status.label}</td></tr>
          </tbody>
        </table>

        <h2>2. Torpaq və süni intellekt</h2>
        <table className="receipt__table">
          <tbody>
            <tr><th>Torpaq</th><td>{p.soilType ?? "—"} · N {num(p.nitrogen)} · P {num(p.phosphorus)} · K {num(p.potassium)} · pH {num(p.ph, 1)}</td></tr>
            <tr><th>AI tövsiyəsi</th><td>{rec ? rec.recommendations.filter((c, i) => i === 0 || c.probability >= 0.01).slice(0, 3).map((c) => `${c.name} (${fit(c.probability)})`).join(" · ") : "…"}</td></tr>
            <tr><th>Model</th><td>{rec?.modelName ?? "…"}{rec?.testAccuracy ? ` · test dəqiqliyi ${pct1(rec.testAccuracy)}` : ""}</td></tr>
          </tbody>
        </table>

        <h2>3. İqlim riski (10 il)</h2>
        <div className="passport__block">{climate ? <ClimateBody data={climate} print /> : climateErr ? unavailable : <Loading />}</div>

        <h2>4. Peyk monitorinqi</h2>
        <div className="passport__block">
          {sat ? (
            <div className="passport__sat">
              <div>
                <b>{sat.headline}</b>
                <p>{sat.message}</p>
                <p className="faint">Son görüntü: {sat.series.length ? date(sat.series[sat.series.length - 1].date) : "—"} · NDVI {sat.latestNdvi?.toFixed(2) ?? "—"} · {sat.series.length} aylıq müşahidə</p>
              </div>
              {sat.images.trueColor && <img src={sat.images.trueColor} alt="Son peyk görüntüsü" />}
              {sat.images.ndvi && <img src={sat.images.ndvi} alt="NDVI xəritəsi" />}
            </div>
          ) : satErr ? unavailable : <Loading />}
        </div>

        <h2>5. Günəş enerjisi</h2>
        <table className="receipt__table">
          <tbody>
            <tr><th>Uyğunluq</th><td>{solar ? `${solar.verdict} · ${solar.score}/100` : "…"}</td></tr>
            <tr><th>Potensial</th><td>{solar ? `${num(solar.kwhPerKwp)} kWh/kWp ildə · optimal bucaq ${solar.optimalTilt}°` : "…"}</td></tr>
            <tr><th>Tariflər</th><td>{solar ? `alış ${num(solar.rules.sellTariff * 100, 1)} qəpik/kWh · kənd təsərrüfatı ${num(solar.rules.agriTariff * 100, 1)} qəpik/kWh · aktiv istehlakçı ${solar.rules.activeConsumerKw} kW-a qədər` : "…"}</td></tr>
          </tbody>
        </table>

        {rec && rec.recommendations[0] && (() => {
          const crop = rec.recommendations[0];
          const e = ECON[crop.code] ?? GENERIC;
          const years = Math.min(p.leaseYears, 15);
          const base = simulate(e, p.areaHa, years);
          const be = breakEven(e);
          return (
            <>
              <h2>6. Ssenari təhlili: {crop.name}, {num(p.areaHa, 1)} ha</h2>
              <table className="receipt__table">
                <tbody>
                  {scenarios(20, 10).map((sc) => {
                    const o = simulate(e, p.areaHa, years, sc.yieldMul, sc.priceMul);
                    const d = base.annual ? Math.round(((o.annual - base.annual) / Math.abs(base.annual)) * 100) : 0;
                    return <tr key={sc.key}><th>{sc.label}</th><td>{money(o.annual)} ildə{sc.key === "base" ? "" : ` (${d}%)`} · {o.payback ? `${o.payback}-ci ildə qaytarılır` : `${years} ildə qaytarılmır`} · {years} ildə {money(o.total)}</td></tr>;
                  })}
                  <tr><th>Zərərsizlik həddi</th><td>məhsul {num(be.yieldT, 2)} t/ha (plan {num(e.yieldT, 1)}) · qiymət {money(Math.round(be.price))}/t (plan {money(e.price)})</td></tr>
                </tbody>
              </table>
              <p className="passport__note">Xərc və qiymətlər portal kalkulyatorunun nümunəvi fərziyyələridir; sahə səhifəsində dəyişdirilə bilər.</p>
            </>
          );
        })()}

        {stats && stats.length > 0 && (
          <>
            <h2>7. {p.district} rayonu: rəsmi statistika</h2>
            <table className="receipt__table">
              <tbody>
                {stats.slice(0, 6).map((s) => <tr key={s.key}><th>{s.label}</th><td>{num(s.district, 1)} {s.unit} ({s.year})</td></tr>)}
              </tbody>
            </table>
          </>
        )}

        <footer className="receipt__foot">
          <p>Mənbələr: ANAMA (opendata.az, ODC-BY); Dövlət Statistika Komitəsi (CC0); ERA5 / Open-Meteo; Copernicus Sentinel-2 (Microsoft Planetary Computer); PVGIS (Avropa Komissiyası JRC); Tarif (Qiymət) Şurasının 29.12.2024 tarixli 19 nömrəli qərarı.</p>
          <p>Torpaq göstəriciləri, infrastruktur məsafələri və investisiya şərtləri nümunəvidir. Pasport məlumat xarakterlidir və hüquqi sənəd deyil. Sahənin canlı səhifəsi: <span className="mono">{url}</span></p>
          <p className="faint">Tərtib edilib: {dateTime(new Date().toISOString())}</p>
        </footer>
      </article>
    </div>
  );
}
