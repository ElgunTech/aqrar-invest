import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { Empty, Loading, MineTag, Tag } from "../components/ui";
import { ACTIVITY } from "../lib/domain";
import { date, money, num, fit } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { Plot } from "../lib/types";

type Row = { label: string; get: (p: Plot) => ReactNode; best?: (ps: Plot[]) => number | null };

const bestBy = (f: (p: Plot) => number, dir: "min" | "max") => (ps: Plot[]) => {
  if (ps.length < 2) return null;
  const vals = ps.map(f);
  const target = dir === "min" ? Math.min(...vals) : Math.max(...vals);
  return vals.filter((v) => v === target).length === 1 ? ps[vals.indexOf(target)].id : null;
};

const yes = (b: boolean) => (b ? <Check size={18} color="#26775a" aria-label="Var" /> : <Minus size={18} color="#9aa69f" aria-label="Yoxdur" />);

const ROWS: Row[] = [
  { label: "Rayon", get: (p) => `${p.district}, ${p.village}` },
  { label: "Təyinat", get: (p) => p.activityType.label },
  { label: "Ərazi", get: (p) => `${num(p.areaHa, 1)} ha`, best: bestBy((p) => p.areaHa, "max") },
  { label: "Minimum investisiya", get: (p) => money(p.minInvestment), best: bestBy((p) => p.minInvestment, "min") },
  { label: "1 ha üçün investisiya", get: (p) => money(p.minInvestment / p.areaHa), best: bestBy((p) => p.minInvestment / p.areaHa, "min") },
  { label: "İcarə müddəti", get: (p) => `${p.leaseYears} il`, best: bestBy((p) => p.leaseYears, "max") },
  { label: "Minadan təmizlənmə", get: (p) => <MineTag label={p.mineClearance} /> },
  { label: "Su mənbəyinə", get: (p) => `${num(p.waterSourceKm, 1)} km`, best: bestBy((p) => p.waterSourceKm, "min") },
  { label: "Asfalt yola", get: (p) => `${num(p.roadKm, 1)} km`, best: bestBy((p) => p.roadKm, "min") },
  { label: "Suvarma", get: (p) => yes(p.irrigationAvailable) },
  { label: "Elektrik", get: (p) => yes(p.electricityAvailable) },
  { label: "AI tövsiyəsi", get: (p) => (p.aiTopCrop ? `${p.aiTopCrop.name} · ${fit(p.aiTopCrop.probability)}` : "yoxdur") },
  { label: "Torpaq pH / N-P-K", get: (p) => <span className="tabular">{num(p.ph, 1)} · {num(p.nitrogen)}-{num(p.phosphorus)}-{num(p.potassium)}</span> },
  { label: "Son müraciət tarixi", get: (p) => (p.openCompetition ? date(p.openCompetition.deadline) : <span className="faint">Müsabiqədə deyil</span>) },
  { label: "Daxil olan müraciətlər", get: (p) => p.applicationCount },
];

export default function Compare() {
  useDocumentTitle("Sahələrin müqayisəsi");
  const [params] = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const { data, loading, error } = useApi<Plot[]>(ids.length >= 1 ? `/api/v1/public/plots/compare?ids=${ids.join(",")}` : null);

  return (
    <>
      <section className="band"><div className="wrap"><h1>Sahələrin müqayisəsi</h1><p>Seçilmiş sahələrin əsas göstəriciləri yan-yana. Ən əlverişli dəyər vurğulanır.</p></div></section>
      <div className="wrap page">
        {ids.length < 2 && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <Empty title="Müqayisə üçün ən azı 2 sahə seçin"><Link className="btn" to="/kataloq" style={{ marginTop: 14 }}>Kataloqdan seç</Link></Empty>
          </div>
        )}
        {loading && <Loading />}
        {error && ids.length >= 2 && <div className="panel"><Empty title={error} /></div>}
        {data && ids.length >= 2 && (
          <div className="panel table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Göstərici</th>
                  {data.map((p) => {
                    const a = ACTIVITY[p.activityType.code];
                    const Icon = a.icon;
                    return (
                      <th key={p.id} style={{ textTransform: "none", letterSpacing: 0, verticalAlign: "top", minWidth: 220 }}>
                        <div className="row" style={{ ["--gap" as string]: "10px" }}>
                          <span style={{ width: 34, height: 34, borderRadius: 9, background: a.tint, color: a.color, display: "grid", placeItems: "center" }}><Icon size={17} /></span>
                          <div>
                            <Link to={`/sahe/${p.id}`} style={{ fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>{p.title}</Link>
                            <div className="mono faint" style={{ fontSize: 11.5 }}>{p.code}</div>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => {
                  const best = r.best?.(data);
                  return (
                    <tr key={r.label}>
                      <td className="muted">{r.label}</td>
                      {data.map((p) => (
                        <td key={p.id} style={best === p.id ? { background: "var(--forest-50)", fontWeight: 650 } : undefined}>
                          {r.get(p)} {best === p.id && <Tag tone="ok">ən yaxşı</Tag>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td />
                  {data.map((p) => (
                    <td key={p.id}>
                      {p.openCompetition
                        ? <Link className="btn btn--sm" to={`/muraciet?plot=${p.id}&competition=${p.openCompetition.id}`}>Müraciət et</Link>
                        : <Link className="btn btn--sm btn--ghost" to={`/sahe/${p.id}`}>Ətraflı</Link>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
