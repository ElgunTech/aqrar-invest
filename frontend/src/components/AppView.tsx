import { Bot, CheckCircle2, CircleDot, Download, FileText, MessageSquareWarning, Send } from "lucide-react";
import type { Application } from "../lib/types";
import { dateTime, fileSize, money } from "../lib/format";
import { Meter, ScoreRing, Tag } from "./ui";

const FLOW = [
  { code: "SUBMITTED", label: "Qəbul edilib" },
  { code: "UNDER_REVIEW", label: "Baxılır" },
  { code: "INFO_REQUESTED", label: "Əlavə məlumat" },
  { code: "DECIDED", label: "Qərar verilib" },
];

export function StatusFlow({ status }: { status: string }) {
  const current = status === "APPROVED" || status === "REJECTED" ? 3 : FLOW.findIndex((f) => f.code === status);
  return (
    <div className="flow" aria-label="Müraciətin mərhələləri">
      {FLOW.map((f, i) => {
        const skipped = f.code === "INFO_REQUESTED" && current > 2 && status !== "INFO_REQUESTED";
        const cls = i < current ? (skipped ? "" : " flow__step--done") : i === current ? " flow__step--current" : "";
        const alert = (status === "INFO_REQUESTED" && i === 2) || (status === "REJECTED" && i === 3);
        return (
          <div key={f.code} className={`flow__step${cls}${alert ? " flow__step--alert" : ""}`} aria-current={i === current ? "step" : undefined}>
            <i>{i < current && !skipped ? "✓" : i + 1}</i>
            <span>{i === 3 && current === 3 ? (status === "APPROVED" ? "Təsdiq edildi" : "İmtina edildi") : f.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Timeline({ app }: { app: Application }) {
  return (
    <ol className="timeline">
      {[...app.history].reverse().map((h, i) => {
        const ektis = h.changedBy === "EKTİS";
        const alert = h.toStatus?.code === "INFO_REQUESTED" || h.toStatus?.code === "REJECTED";
        const same = h.fromStatus?.code === h.toStatus?.code;
        return (
          <li key={i}>
            <span className={`timeline__dot${ektis ? " timeline__dot--ektis" : alert ? " timeline__dot--alert" : ""}`}>
              {ektis ? <Bot /> : alert ? <MessageSquareWarning /> : h.toStatus?.code === "APPROVED" ? <CheckCircle2 /> : <CircleDot />}
            </span>
            <div className="timeline__when">{dateTime(h.changedAt)} · {h.changedBy}</div>
            <div className="timeline__what">{same || !h.toStatus ? (ektis ? "EKTİS bildirişi" : "Qeyd") : h.toStatus.label}</div>
            {h.comment && <div className="timeline__note">{h.comment}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function ScoreCard({ app }: { app: Application }) {
  return (
    <section className="panel">
      <div className="panel__head"><h3>Avtomatik ilkin qiymətləndirmə</h3><Tag tone="muted">qərar dəstəyi</Tag></div>
      <div className="panel__body">
        <div className="row row--top" style={{ ["--gap" as string]: "24px" }}>
          <ScoreRing value={app.score.total} />
          <div className="grow">
            {app.score.items.map((s) => (
              <div key={s.criterion} style={{ marginBottom: 10 }}>
                <div className="row row--between" style={{ fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600 }}>{s.criterion}</span>
                  <span className="tabular" style={{ fontWeight: 700 }}>{s.points}/{s.max}</span>
                </div>
                <Meter value={s.points / s.max} gold={s.criterion.startsWith("AI")} />
                <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ApplicationFacts({ app, docBase }: { app: Application; docBase: string }) {
  return (
    <div className="grid grid--2">
      <section className="panel">
        <div className="panel__head"><h3>Müraciətçi və investisiya</h3></div>
        <div className="panel__body">
          <dl className="kv" style={{ gridTemplateColumns: "minmax(120px,170px) 1fr" }}>
            <dt>Müraciətçi</dt><dd>{app.applicantName}</dd>
            <dt>Növ</dt><dd>{app.applicantType.label}</dd>
            <dt>FİN / VÖEN</dt><dd className="mono">{app.taxId}</dd>
            <dt>Əlaqə</dt><dd>{app.phone}<br />{app.email}</dd>
            <dt>Fəaliyyət</dt><dd>{app.activityType.label}{app.plannedCropName && ` · ${app.plannedCropName}`}</dd>
            <dt>İnvestisiya</dt><dd>{money(app.plannedInvestment)} · öz vəsaiti {app.ownFundsPercent}%</dd>
            <dt>İş yerləri</dt><dd>{app.jobsCreated}</dd>
            <dt>Müddət / təcrübə</dt><dd>{app.projectMonths} ay · {app.experienceYears} il</dd>
          </dl>
        </div>
      </section>
      <section className="panel">
        <div className="panel__head"><h3>Sənədlər</h3><span className="faint" style={{ fontSize: 13 }}>{app.documents.length} fayl</span></div>
        <div className="panel__body">
          <ul className="checklist">
            {app.documents.map((d) => (
              <li key={d.id}>
                <FileText color="#4b5c54" />
                <span className="grow">
                  <div style={{ fontWeight: 600 }}>{d.type.label}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{d.originalName} · {fileSize(d.sizeBytes)}</div>
                </span>
                <a className="btn btn--sm btn--ghost" href={`${docBase}/${app.id}/documents/${d.id}`}><Download size={14} /> Yüklə</a>
              </li>
            ))}
          </ul>
          <hr className="divider" />
          <h4 style={{ marginBottom: 6 }}>Biznes planın xülasəsi</h4>
          <p className="muted" style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{app.businessPlan}</p>
        </div>
      </section>
    </div>
  );
}

export function EktisBox({ app }: { app: Application }) {
  return (
    <div className="callout callout--info" style={{ alignItems: "center" }}>
      <Send />
      <div className="grow">
        <b>EKTİS inteqrasiyası:</b> <Tag label={app.ektisStatus} /> {app.ektisReference && <span className="mono" style={{ marginLeft: 6 }}>{app.ektisReference}</span>}
      </div>
    </div>
  );
}
