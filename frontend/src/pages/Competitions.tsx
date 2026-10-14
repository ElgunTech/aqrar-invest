import { Link } from "react-router-dom";
import { CalendarClock, FileCheck2, Layers, ShieldCheck } from "lucide-react";
import { Empty, Loading, Tag } from "../components/ui";
import { countdown, date, num } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { Competition } from "../lib/types";

export default function Competitions() {
  useDocumentTitle("Müsabiqələr");
  const { data, loading } = useApi<Competition[]>("/api/v1/public/competitions");

  return (
    <>
      <section className="band">
        <div className="wrap">
          <h1>İnvestisiya müsabiqələri</h1>
          <p>Hər müsabiqə iki şəxs tərəfindən yoxlanılır: biri yaradır, digəri təsdiq edib elan edir. Şərtlər, sahələr və son tarix aşağıda.</p>
        </div>
      </section>
      <div className="wrap page">
        {loading && <Loading />}
        {data && data.length === 0 && <div className="panel"><Empty title="Hazırda elan edilmiş müsabiqə yoxdur" /></div>}
        <div className="stack" style={{ ["--gap" as string]: "22px" }}>
          {data?.map((c) => (
            <article key={c.id} id={`c${c.id}`} className="panel">
              <div className="panel__head" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="mono faint" style={{ fontSize: 12 }}>{c.code}</span>
                    <Tag label={c.status} />
                    {c.open && <Tag tone="gold"><CalendarClock /> {countdown(c.deadline)} qalıb</Tag>}
                  </div>
                  <h2 style={{ fontSize: 21 }}>{c.title}</h2>
                </div>
                <div className="right" style={{ textAlign: "right", flex: "none" }}>
                  <div className="metric__label" style={{ justifyContent: "flex-end" }}>Son tarix</div>
                  <div style={{ font: "700 18px var(--font-display)" }}>{date(c.deadline)}</div>
                </div>
              </div>
              <div className="panel__body">
                <div className="layout-2" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
                  <div className="stack" style={{ ["--gap" as string]: "14px" }}>
                    <p>{c.description}</p>
                    {c.requirements && (
                      <div className="callout callout--info"><FileCheck2 /><div><b>Tələblər.</b> {c.requirements}</div></div>
                    )}
                    <div>
                      <h4 style={{ marginBottom: 8 }}><Layers size={15} style={{ verticalAlign: -2 }} /> Müsabiqəyə çıxarılan sahələr</h4>
                      <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 10 }}>
                        <table className="table table--compact">
                          <thead><tr><th>Kod</th><th>Sahə</th><th>Rayon</th><th>Təyinat</th><th className="num">Ərazi</th><th /></tr></thead>
                          <tbody>
                            {c.plots.map((p) => (
                              <tr key={p.id}>
                                <td className="mono">{p.code}</td>
                                <td>{p.title}</td>
                                <td>{p.district}</td>
                                <td>{p.activityLabel}</td>
                                <td className="num">{num(p.areaHa, 1)} ha</td>
                                <td className="num"><Link to={`/sahe/${p.id}`} className="btn btn--sm btn--ghost">Bax</Link></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <aside className="panel panel--pad" style={{ background: "var(--surface-2)", boxShadow: "none" }}>
                    <dl className="kv" style={{ gridTemplateColumns: "1fr", gap: 4 }}>
                      <dt>Başlama tarixi</dt><dd>{date(c.startDate)}</dd>
                      <dt>Sahələr</dt><dd>{c.plots.length} sahə · {num(c.plots.reduce((s, p) => s + p.areaHa, 0))} ha</dd>
                      <dt>Daxil olan müraciətlər</dt><dd>{c.applicationCount}</dd>
                      <dt>Təsdiq edən</dt><dd className="row" style={{ ["--gap" as string]: "6px" }}><ShieldCheck size={15} color="#26775a" /> {c.approvedBy ?? "yoxdur"}</dd>
                    </dl>
                    {c.open && <Link className="btn btn--block" style={{ marginTop: 16 }} to={`/kataloq`}>Sahə seç və müraciət et</Link>}
                  </aside>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
