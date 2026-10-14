import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FilePlus2, Inbox, MessageSquareReply, RefreshCw, Upload } from "lucide-react";
import { ApplicationFacts, EktisBox, ScoreCard, StatusFlow, Timeline } from "../components/AppView";
import { Callout, Empty, Loading, Tag, useToast } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { date, money } from "../lib/format";
import { useApi, useDocumentTitle, useMeta } from "../lib/hooks";
import type { Application, ApplicationListItem } from "../lib/types";

function Reply({ app, onDone }: { app: Application; onDone: () => void }) {
  const meta = useMeta();
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("FINANCIAL_PROOF");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("comment", comment);
      if (file) {
        fd.append("files", file);
        fd.append("types", type);
      }
      await api(`/api/v1/me/applications/${app.id}/reply`, { method: "POST", form: fd });
      toast("Cavabınız göndərildi, müraciət yenidən baxılır");
      onDone();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" style={{ borderColor: "#f2c9c3" }}>
      <div className="panel__head" style={{ background: "var(--danger-100)", borderRadius: "16px 16px 0 0" }}>
        <h3 style={{ color: "#8a281e" }}><MessageSquareReply size={18} /> Əlavə məlumat tələb olunur</h3>
      </div>
      <div className="panel__body">
        <p style={{ marginBottom: 14 }}>{[...app.history].reverse().find((h) => h.toStatus?.code === "INFO_REQUESTED")?.comment}</p>
        <div className="field">
          <label htmlFor="reply">Cavabınız</label>
          <textarea id="reply" className="textarea" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="rt">Sənədin növü</label>
            <select id="rt" className="select" value={type} onChange={(e) => setType(e.target.value)}>
              {meta?.documentTypes.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="label">Sənəd (istəyə bağlı)</span>
            <label className="btn btn--ghost" style={{ justifyContent: "flex-start" }}>
              <Upload size={16} /> {file ? file.name : "Fayl seç"}
              <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <button className="btn" disabled={busy || !comment.trim()} onClick={send}>{busy ? "Göndərilir…" : "Cavabı göndər"}</button>
      </div>
    </section>
  );
}

function Detail({ id }: { id: string }) {
  const { data: app, reload } = useApi<Application>(`/api/v1/me/applications/${id}`);
  const { refresh } = useAuth();
  useDocumentTitle(app ? app.applicationNumber : "Müraciət");

  // Poll briefly while EKTİS has not answered yet, so the round-trip is visible live.
  useEffect(() => {
    if (!app || app.ektisStatus.code === "VERIFIED" || app.ektisStatus.code === "FAILED") return;
    const t = setInterval(() => { reload(); refresh(); }, 3000);
    return () => clearInterval(t);
  }, [app, reload, refresh]);

  if (!app) return <Loading />;
  return (
    <div className="stack" style={{ ["--gap" as string]: "20px" }}>
      <div className="row row--between">
        <Link to="/kabinet" className="btn btn--sm btn--quiet"><ArrowLeft size={15} /> Bütün müraciətlər</Link>
        <button className="btn btn--sm btn--ghost" onClick={reload}><RefreshCw size={14} /> Yenilə</button>
      </div>
      <div className="panel panel--pad">
        <div className="row row--between row--top" style={{ marginBottom: 18 }}>
          <div>
            <div className="mono faint" style={{ fontSize: 13 }}>{app.applicationNumber}</div>
            <h2 style={{ marginTop: 4 }}>{app.plotTitle}</h2>
            <div className="muted" style={{ fontSize: 14 }}>{app.competitionTitle}</div>
          </div>
          <Tag label={app.status} />
        </div>
        <StatusFlow status={app.status.code} />
        {app.decisionNote && <div style={{ marginTop: 16 }}><Callout tone={app.status.code === "APPROVED" ? "ok" : "warn"}><b>Komissiyanın qərarı:</b> {app.decisionNote}</Callout></div>}
      </div>
      {app.status.code === "INFO_REQUESTED" && <Reply app={app} onDone={reload} />}
      <EktisBox app={app} />
      <div className="layout-2" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
        <div className="stack" style={{ ["--gap" as string]: "20px" }}>
          <ScoreCard app={app} />
          <ApplicationFacts app={app} docBase="/api/v1/me/applications" />
        </div>
        <section className="panel">
          <div className="panel__head"><h3>Müraciətin tarixçəsi</h3></div>
          <div className="panel__body"><Timeline app={app} /></div>
        </section>
      </div>
    </div>
  );
}

export default function Cabinet() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: list } = useApi<ApplicationListItem[]>(id ? null : "/api/v1/me/applications");
  useDocumentTitle("Şəxsi kabinet");

  return (
    <>
      <section className="band">
        <div className="wrap row row--between">
          <div>
            <h1>Şəxsi kabinet</h1>
            <p>{user?.fullName} · müraciətlərinizin statusu, tarixçəsi və bildirişlər</p>
          </div>
          <Link className="btn btn--amber" to="/kataloq"><FilePlus2 size={17} /> Yeni müraciət</Link>
        </div>
      </section>
      <div className="wrap page">
        {id ? <Detail id={id} /> : !list ? <Loading /> : list.length === 0 ? (
          <div className="panel"><Empty title="Hələ müraciətiniz yoxdur" icon={<Inbox aria-hidden />}>Kataloqdan açıq müsabiqədə olan sahəni seçin.<br /><Link className="btn" style={{ marginTop: 14 }} to="/kataloq">Sahə seç</Link></Empty></div>
        ) : (
          <div className="panel table-wrap">
            <table className="table">
              <thead><tr><th>Nömrə</th><th>Sahə</th><th>Müsabiqə</th><th className="num">İnvestisiya</th><th>Status</th><th>EKTİS</th><th>Tarix</th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="is-clickable" onClick={() => nav(`/kabinet/${a.id}`)}>
                    <td className="mono"><Link to={`/kabinet/${a.id}`}>{a.applicationNumber}</Link></td>
                    <td><div style={{ fontWeight: 600 }}>{a.plotTitle}</div><div className="faint" style={{ fontSize: 12 }}>{a.district} · {a.plotCode}</div></td>
                    <td style={{ maxWidth: 260 }}>{a.competitionTitle}</td>
                    <td className="num">{money(a.plannedInvestment)}</td>
                    <td><Tag label={a.status} /></td>
                    <td><Tag label={a.ektisStatus} /></td>
                    <td>{date(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
