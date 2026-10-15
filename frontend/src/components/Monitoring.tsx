import { enqueue, remove as removeQueued, retry as retryQueued, useOfflineQueue, type QueuedReport } from "../lib/offlineReports";
import { useState } from "react";
import exifr from "exifr";
import { AlertTriangle, Camera, CheckCircle2, Clock, CloudOff, MapPin, RefreshCw, Upload, WifiOff } from "lucide-react";
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
  const { items: queue, online } = useOfflineQueue();
  const mine = (id: number) => queue.filter((q) => q.applicationId === project.applicationId && q.milestoneId === id);
  return (
    <>
    {mode === "investor" && !online && (
      <div className="offline-banner"><WifiOff size={16} /> İnternet yoxdur. Hesabatları yenə də doldura bilərsiniz: cihazda saxlanılacaq və bağlantı yaranan kimi avtomatik göndəriləcək.</div>
    )}
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
          {mode === "investor" && mine(m.id).map((q) => <QueuedRow key={q.id} q={q} />)}
          {mode === "investor" && m.status !== "ACCEPTED" && m.status !== "REPORTED" && !mine(m.id).some((q) => q.status === "pending" || q.status === "sending") && (
            open === m.id
              ? <ReportForm project={project} m={m} onDone={(p) => { setOpen(null); onChange(p); }} onQueued={() => setOpen(null)} />
              : <button className="btn btn--sm btn--ghost" style={{ marginTop: 10 }} onClick={() => setOpen(m.id)}><Upload size={14} /> Hesabat ver</button>
          )}
        </li>
      ))}
    </ol>
    </>
  );
}

const QUEUE_LABEL: Record<QueuedReport["status"], string> = {
  pending: "Cihazda saxlanılıb · göndərilməyi gözləyir",
  sending: "Göndərilir…",
  sent: "Göndərildi",
  error: "Xəta",
};

/** A report waiting on the device (or just delivered from it) with its delivery state. */
function QueuedRow({ q }: { q: QueuedReport }) {
  const [thumb] = useState(() => URL.createObjectURL(q.photo));
  return (
    <div className={`queued queued--${q.status}`}>
      <img src={thumb} alt="" width={44} height={44} />
      <div className="grow">
        <div className="queued__state">
          {q.status === "pending" && <CloudOff size={14} />}
          {q.status === "sending" && <RefreshCw size={14} className="spin" />}
          {q.status === "sent" && <CheckCircle2 size={14} />}
          {q.status === "error" && <AlertTriangle size={14} />}
          <b>{QUEUE_LABEL[q.status]}</b>
          <span className="faint">· {dateTime(new Date(q.createdAt).toISOString())}</span>
        </div>
        <div className="faint" style={{ fontSize: 12.5 }}>{q.text.slice(0, 90)}{q.text.length > 90 ? "…" : ""} · {money(Number(q.investment))}{q.lat != null ? ` · GPS (${q.gpsSource === "device" ? "cihaz" : "foto"})` : " · GPS yoxdur"}</div>
        {q.error && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{q.error}</div>}
      </div>
      {q.status === "error" && <button className="btn btn--sm btn--ghost" onClick={() => retryQueued(q.id)}>Yenidən göndər</button>}
      {(q.status === "error" || q.status === "pending") && <button className="btn btn--sm btn--quiet" onClick={() => { if (confirm("Cihazda saxlanılan hesabat silinsin?")) void removeQueued(q.id); }}>Sil</button>}
    </div>
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

function ReportForm({ project, m, onDone, onQueued }: { project: Project; m: MilestoneInfo; onDone: (p: Project) => void; onQueued: () => void }) {
  const [text, setText] = useState("");
  const [investment, setInvestment] = useState(String(m.expectedInvestment));
  const [photo, setPhoto] = useState<File | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; source: "exif" | "device" } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (f: File | null) => {
    setPhoto(f);
    setGps(null);
    if (!f) return;
    try {
      const g = await exifr.gps(f);
      if (g?.latitude && g?.longitude) setGps({ lat: g.latitude, lng: g.longitude, source: "exif" });
    } catch {
      /* no EXIF: the report is still accepted and marked "no GPS" */
    }
  };

  // Phone cameras opened from a browser often strip location from the photo; the device's GPS works without internet.
  const locate = () => {
    if (!navigator.geolocation) return toast("Bu cihazda GPS mövcud deyil", true);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "device" }); setLocating(false); },
      () => { toast("Mövqe alınmadı: GPS icazəsini yoxlayın", true); setLocating(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    );
  };

  const saveOffline = async () => {
    if (!photo) return;
    await enqueue({
      applicationId: project.applicationId, milestoneId: m.id, milestoneTitle: m.title, text, investment,
      photo, photoName: photo.name, lat: gps?.lat, lng: gps?.lng, gpsSource: gps?.source,
    });
    toast(navigator.onLine ? "Hesabat növbəyə alındı, göndərilir" : "İnternet yoxdur: hesabat cihazda saxlanıldı, bağlantı yarananda göndəriləcək");
    onQueued();
  };

  const send = async () => {
    if (!photo) return;
    if (!navigator.onLine) return saveOffline();
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
      // a network failure (no ApiError status) means the signal dropped mid-upload: keep the report on the device
      if (e instanceof TypeError) await saveOffline();
      else toast((e as Error).message, true);
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
          {photo && <span className="hint">{gps ? `GPS (${gps.source === "device" ? "cihaz" : "foto"}): ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "Fotoda GPS tapılmadı"}</span>}
          {photo && !gps && <button type="button" className="btn btn--sm btn--ghost" style={{ marginTop: 6 }} onClick={locate} disabled={locating}><MapPin size={14} /> {locating ? "Mövqe təyin edilir…" : "Cihazın GPS-i ilə təyin et"}</button>}
        </div>
      </div>
      <button className="btn btn--sm" disabled={busy || !photo || !text.trim()} onClick={send}>{navigator.onLine ? "Hesabatı göndər" : <><CloudOff size={14} /> Cihazda saxla</>}</button>
      <span className="hint" style={{ marginLeft: 10 }}>İnternet olmasa, hesabat cihazda saxlanılır və sonra özü göndərilir.</span>
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
