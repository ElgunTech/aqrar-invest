import { useT } from "../lib/i18n";
import { Link } from "react-router-dom";
import type { Plot } from "../lib/types";
import { ACTIVITY } from "../lib/domain";
import { date, num, fit } from "../lib/format";

export function PlotCard({ plot: p, compare }: { plot: Plot; compare?: { checked: boolean; onToggle: () => void } }) {
  const { t } = useT();
  const a = ACTIVITY[p.activityType.code];
  const Icon = a.icon;
  return (
    <article className="plot">
      <div className="plot__body">
        <div className="plot__top">
          <span className="plot__kind"><Icon size={15} color={a.color} aria-hidden /> {t(p.activityType.label)}</span>
          <span className="mono">{p.code}</span>
        </div>
        <div>
          <Link to={`/sahe/${p.id}`} className="plot__title">{p.title}</Link>
          <div className="plot__place">{p.district} {t("rayonu")}, {p.village}</div>
        </div>
        <dl className="plot__facts">
          <div><dt>{t("Ərazi")}</dt><dd>{num(p.areaHa, 1)} ha</dd></div>
          <div><dt>{t("Min. investisiya")}</dt><dd>{num(p.minInvestment / 1000)}k ₼</dd></div>
          <div><dt>{t("Suya qədər")}</dt><dd>{num(p.waterSourceKm, 1)} km</dd></div>
        </dl>
        <div className="stack" style={{ ["--gap" as string]: "4px", fontSize: 13.5 }}>
          <span className={`plot__mine plot__mine--${p.mineClearance.code}`}>{t(p.mineClearance.label)}</span>
          {p.aiTopCrop && <span className="ai-line">{t("Torpağa ən uyğun bitki:")} <b>{t(p.aiTopCrop.name)}</b> ({t(fit(p.aiTopCrop.probability))})</span>}
        </div>
        <div className="plot__foot">
          <span style={{ fontSize: 13 }} className={p.openCompetition ? "" : "faint"}>
            {p.openCompetition ? <>{t("Son müraciət:")} <b>{date(p.openCompetition.deadline)}</b></> : t(p.status.label)}
          </span>
          <div className="row" style={{ ["--gap" as string]: "12px" }}>
            {compare && (
              <label className="check" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={compare.checked} onChange={compare.onToggle} /> {t("Müqayisə")}
              </label>
            )}
            <Link className="btn btn--sm btn--ghost" to={`/sahe/${p.id}`}>{t("Ətraflı")}</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
