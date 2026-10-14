import { useState } from "react";
import exifr from "exifr";
import { AlertTriangle, Camera, CheckCircle2, Clock, MapPin, Upload } from "lucide-react";
import { api } from "../lib/api";
import { date, dateTime, money } from "../lib/format";
import type { MilestoneInfo, Project, Signal } from "../lib/types";
import { useToast } from "./ui";

const LIGHT_TEXT: Record<string, string> = { green: "Vaxtında", yellow: "Diqqət", red: "Gecikir / pozuntu", grey: "Planlaşdırılıb" };

export function Light({ value, label }: { value: string; label?: string }) {
  return <span className={`light light--${value}`}><i />{label ?? LIGHT_TEXT[value]}</span>;
}

function statusText(m: MilestoneInfo): string {
  if (m.status === "ACCEPTED") return "Qəbul edilib";
  if (m.status === "REPORTED") return "Hesabat yoxlanılır";
  if (m.status === "REJECTED") return "Hesabat geri qaytarılıb";
  if (m.daysLeft < 0) return `${-m.daysLeft} gün gecikir`;
  return `${m.daysLeft} gün qalıb`;
}

function GpsLine({ m }: { m: MilestoneInfo }) {
  if (!m.reportedAt) return null;
  if (m.gpsInsidePlot === null) return <span className="gps gps--warn"><MapPin size={13} /> Fotoda GPS yoxdur</span>;
  return m.gpsInsidePlot
    ? <span className="gps gps--ok"><MapPin size={13} /> Foto sahənin daxilində çəkilib ({m.gpsDistanceM} m)</span>
    : <span className="gps gps--bad"><MapPin size={13} /> Foto sahədən {((m.gpsDistanceM ?? 0) / 1000).toFixed(1)} km uzaqda çəkilib</span>;
}

/** The obligation plan as a vertical list; staff get review actions, the investor gets the report form. */
export function MilestoneList({ project, mode, onChange }: { project: Project; mode: "investor" | "staff"; onChange: (p: Project) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ol className="ms-list">
      {project.milestones.map((m) => (
        <li key={m.id} className={`ms ms--${m.light}`}>
          <div className="ms__head">
            <span className="ms__seq">{m.seq}</span>
            <div className="grow">
              <div className="ms__title">{m.title}</div>
              <div className="faint" style={{ fontSize: 12.5 }}>
                Son tarix {date(m.dueDate)} · investisiyanın {m.investmentPercent}%-i ({money(m.expectedInvestment)})
              </div>
            </div>
            <Light value={m.light} label={statusText(m)} />
          </div>
          {m.reportedAt && (
            <div className="ms__report">
              <div className="row" style={{ ["--gap" as string]: "8px", marginBottom: 4 }}>
                <b>Hesabat</b><span className="faint">{dateTime(m.reportedAt)}</span>
                {m.reportedInvestment != null && <span>· reallaşdırılıb: <b>{money(m.reportedInvestment)}</b></span>}
              </div>
              <p>{m.reportText}</p>
              <div className="row" style={{ marginTop: 6 }}>
                {m.hasPhoto && <a href={`/api/v1/${mode === "staff" ? "admin" : "me"}/milestones/${m.id}/photo`} target="_blank" rel="noreferrer"><Camera size={13} /> Foto</a>}
                <GpsLine m={m} />
              </div>
              {m.reviewNote && <p className="faint" style={{ marginTop: 6 }}>{m.reviewedBy}: {m.reviewNote}</p>}
            </div>
          )}
          {mode === "staff" && m.status === "REPORTED" && <ReviewBar m={m} onChange={onChange} />}
          {mode === "investor" && m.status !== "ACCEPTED" && m.status !== "REPORTED" && (
            open === m.id
              ? <ReportForm project={project} m={m} onDone={(p) => { setOpen(null); onChange(p); }} />
              : <button className="btn btn--sm btn--ghost" style={{ marginTop: 10 }} onClick={() => setOpen(m.id)}><Upload size={14} /> Hesabat ver</button>
          )}
        </li>
      ))}
    </ol>
  );
}

function ReviewBar({ m, onChange }: { m: MilestoneInfo; onChange: (p: Project) => void }) {
  const [note, setNote] = useState("");
  const toast = useToast();
  const act = async (accepted: boolean) => {
    try {
      onChange(await api<Project>(`/api/v1/admin/milestones/${m.id}/review`, { method: "POST", body: { accepted, note } }));
      toast(accepted ? "Mərhələ qəbul edildi" : "Hesabat geri qaytarıldı");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <div className="row" style={{ marginTop: 10, flexWrap: "nowrap" }}>
      <input className="input" placeholder="Qeyd (geri qaytaranda məcburi)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn--sm" onClick={() => act(true)}><CheckCircle2 size={14} /> Qəbul et</button>
      <button className="btn btn--sm btn--ghost" onClick={() => act(false)}>Geri qaytar</button>
    </div>
  );
}

function ReportForm({ project, m, onDone }: { project: Project; m: MilestoneInfo; onDone: (p: Project) => void }) {
  const [text, setText] = useState("");
  const [investment, setInvestment] = useState(String(m.expectedInvestment));
  const [photo, setPhoto] = useState<File | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (f: File | null) => {
    setPhoto(f);
    setGps(null);
    if (!f) return;
    try {
      const g = await exifr.gps(f);
      if (g?.latitude && g?.longitude) setGps({ lat: g.latitude, lng: g.longitude });
    } catch {
      /* no EXIF: the report is still accepted and marked "no GPS" */
    }
  };

  const send = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("text", text);
      fd.append("investment", investment);
      fd.append("photo", photo);
      if (gps) {
        fd.append("lat", String(gps.lat));
        fd.append("lng", String(gps.lng));
      }
      onDone(await api<Project>(`/api/v1/me/applications/${project.applicationId}/milestones/${m.id}/report`, { method: "POST", form: fd }));
      toast("Hesabat göndərildi");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ms__form">
      <div className="field"><label htmlFor={`t${m.id}`}>Görülən işlər</label><textarea id={`t${m.id}`} className="textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 80 }} /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor={`i${m.id}`}>Reallaşdırılmış investisiya (₼)</label><input id={`i${m.id}`} className="input" type="number" min={0} value={investment} onChange={(e) => setInvestment(e.target.value)} /></div>
        <div className="field">
          <span className="label">Sahədən foto (JPG, GPS ilə)</span>
          <label className="btn btn--ghost" style={{ justifyContent: "flex-start" }}>
            <Camera size={15} /> {photo ? photo.name : "Foto seç"}
            <input type="file" className="sr-only" accept=".jpg,.jpeg,.png" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
          {photo && <span className="hint">{gps ? `GPS oxundu: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "Fotoda GPS tapılmadı, hesabat \"GPS yoxdur\" kimi qeyd olunacaq"}</span>}
        </div>
      </div>
      <button className="btn btn--sm" disabled={busy || !photo || !text.trim()} onClick={send}>Hesabatı göndər</button>
    </div>
  );
}

export function IntegrityPanel({ signals }: { signals: Signal[] }) {
  if (!signals.length) {
    return <div className="callout callout--ok"><CheckCircle2 /><div><b>Dürüstlük yoxlaması:</b> şübhəli uyğunluq tapılmadı.</div></div>;
  }
  return (
    <section className="panel integrity">
      <div className="panel__head"><h3><AlertTriangle size={17} color="#b4372a" /> Dürüstlük siqnalları ({signals.length})</h3><span className="faint" style={{ fontSize: 12.5 }}>Qərar vermir, diqqət tələb edir</span></div>
      <ul>
        {signals.map((s) => (
          <li key={s.code + s.text} className={`sig sig--${s.level}`}><span>{s.level === "HIGH" ? "Yüksək" : "Orta"}</span>{s.text}</li>
        ))}
      </ul>
    </section>
  );
}

export function NextDue({ project }: { project: Project }) {
  const next = project.milestones.find((m) => m.status !== "ACCEPTED");
  if (!next) return <span className="faint">Bütün öhdəliklər icra olunub</span>;
  return <span><Clock size={13} style={{ verticalAlign: -2 }} /> {next.title}: {date(next.dueDate)}</span>;
}
