import { Link } from "react-router-dom";
import type { Plot } from "../lib/types";
import { ACTIVITY } from "../lib/domain";
import { date, num, pct } from "../lib/format";

export function PlotCard({ plot: p, compare }: { plot: Plot; compare?: { checked: boolean; onToggle: () => void } }) {
  const a = ACTIVITY[p.activityType.code];
  const Icon = a.icon;
  return (
    <article className="plot">
      <div className="plot__body">
        <div className="plot__top">
          <span className="plot__kind"><Icon size={15} color={a.color} aria-hidden /> {p.activityType.label}</span>
          <span className="mono">{p.code}</span>
        </div>
        <div>
          <Link to={`/sahe/${p.id}`} className="plot__title">{p.title}</Link>
          <div className="plot__place">{p.district} rayonu, {p.village}</div>
        </div>
        <dl className="plot__facts">
          <div><dt>Ərazi</dt><dd>{num(p.areaHa, 1)} ha</dd></div>
          <div><dt>Min. investisiya</dt><dd>{num(p.minInvestment / 1000)} min ₼</dd></div>
          <div><dt>Suya qədər</dt><dd>{num(p.waterSourceKm, 1)} km</dd></div>
        </dl>
        <div className="stack" style={{ ["--gap" as string]: "4px", fontSize: 13.5 }}>
          <span className={`plot__mine plot__mine--${p.mineClearance.code}`}>{p.mineClearance.label}</span>
          {p.aiTopCrop && <span className="ai-line">Torpağa ən uyğun bitki: <b>{p.aiTopCrop.name}</b> ({pct(p.aiTopCrop.probability)})</span>}
        </div>
        <div className="plot__foot">
          <span style={{ fontSize: 13 }} className={p.openCompetition ? "" : "faint"}>
            {p.openCompetition ? <>Son müraciət: <b>{date(p.openCompetition.deadline)}</b></> : p.status.label}
          </span>
          <div className="row" style={{ ["--gap" as string]: "12px" }}>
            {compare && (
              <label className="check" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={compare.checked} onChange={compare.onToggle} /> Müqayisə
              </label>
            )}
            <Link className="btn btn--sm btn--ghost" to={`/sahe/${p.id}`}>Ətraflı</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
