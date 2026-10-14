import { useMemo, useState, type FormEvent } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, BrainCircuit, CheckCheck, ClipboardList, Download, FileSearch, Gauge, History, MapPinned, Pencil, Plus, Power, RefreshCw,
  RotateCcw, Send, ShieldCheck, Trash2, Trophy, Undo2, X,
} from "lucide-react";
import { ApplicationFacts, CommissionPanel, EktisBox, ScoreCard, StatusFlow, Timeline } from "../components/AppView";
import { IntegrityPanel, Light, MilestoneList, NextDue } from "../components/Monitoring";
import { Callout, Drawer, Empty, Loading, MineTag, Tag, useToast } from "../components/ui";
import { api, ApiError, qs } from "../lib/api";
import { useAuth } from "../lib/auth";
import { date, dateTime, money, num, pct, pct1 } from "../lib/format";
import { useApi, useDebounced, useDocumentTitle, useMeta } from "../lib/hooks";
import type {
  Application, ApplicationListItem, AuditEntry, Competition, Dashboard, IntegrationEvent, ModelInfo, Plot, Project,
} from "../lib/types";

type TabKey = "overview" | "applications" | "monitoring" | "plots" | "competitions" | "integration" | "audit";

// ------------------------------------------------------------------ overview

function Overview({ go }: { go: (t: TabKey) => void }) {
  const { data: d } = useApi<Dashboard>("/api/v1/admin/dashboard");
  if (!d) return <Loading />;
  const perDay = Object.entries(d.applicationsPerDay).map(([day, v]) => ({ day: day.slice(5).replace("-", "."), v }));
  const s = d.statusCounts;
  return (
    <div className="stack" style={{ ["--gap" as string]: "20px" }}>
      <div className="grid grid--4">
        <button className="panel metric" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => go("applications")}>
          <div className="metric__label"><ClipboardList size={14} /> Baxılmalı müraciətlər</div>
          <div className="metric__value">{(s.SUBMITTED ?? 0) + (s.UNDER_REVIEW ?? 0)}</div>
          <div className="metric__hint">{s.SUBMITTED ?? 0} yeni · {s.UNDER_REVIEW ?? 0} baxılır · {s.INFO_REQUESTED ?? 0} cavab gözləyir</div>
        </button>
        <button className="panel metric" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => go("competitions")}>
          <div className="metric__label"><Trophy size={14} /> Təsdiq gözləyən müsabiqə</div>
          <div className="metric__value">{d.pendingApprovalCompetitions}</div>
          <div className="metric__hint">{d.openCompetitions} açıq müsabiqə</div>
        </button>
        <div className="panel metric">
          <div className="metric__label"><Gauge size={14} /> Orta avtomatik bal</div>
          <div className="metric__value">{d.averageAutoScore}</div>
          <div className="metric__hint">{d.applicationCount} müraciət üzrə</div>
        </div>
        <div className="panel metric">
          <div className="metric__label"><Send size={14} /> EKTİS-də təsdiqlənib</div>
          <div className="metric__value">{d.ektisVerified}/{d.applicationCount}</div>
          <div className="metric__hint">fermer reyestri yoxlaması</div>
        </div>
      </div>
      <div className="grid grid--2">
        <section className="panel">
          <div className="panel__head"><h3>Son 30 gündə daxil olan müraciətlər</h3></div>
          <div className="panel__body" style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={perDay}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d5c43" stopOpacity={0.35} /><stop offset="1" stopColor="#1d5c43" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e5ebe7" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval={4} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip />
                <Area type="monotone" dataKey="v" name="Müraciət" stroke="#1d5c43" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel__head"><h3>Rayonlar üzrə planlaşdırılan investisiya</h3></div>
          <div className="panel__body" style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={Object.entries(d.investmentByDistrict).map(([name, value]) => ({ name, value }))}>
                <CartesianGrid vertical={false} stroke="#e5ebe7" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="value" name="İnvestisiya" fill="#d9a23a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div className="grid grid--4">
        <div className="panel metric"><div className="metric__label">Sahələr</div><div className="metric__value">{d.plotCount}</div><div className="metric__hint">{num(d.totalAreaHa)} ha</div></div>
        <div className="panel metric"><div className="metric__label">Minadan təmizlənmiş</div><div className="metric__value">{d.clearedPlots}</div></div>
        <div className="panel metric"><div className="metric__label">Planlaşdırılan investisiya</div><div className="metric__value" style={{ fontSize: 22 }}>{money(d.plannedInvestment)}</div></div>
        <div className="panel metric"><div className="metric__label">Yeni iş yerləri</div><div className="metric__value">{num(d.plannedJobs)}</div></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ applications

function ApplicationDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { data: app, reload, setData } = useApi<Application>(`/api/v1/admin/applications/${id}`);
  const [status, setStatus] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const change = async () => {
    setBusy(true);
    try {
      const updated = await api<Application>(`/api/v1/admin/applications/${id}/status`, { method: "POST", body: { status, comment } });
      setData(updated);
      setStatus("");
      setComment("");
      toast("Status yeniləndi, sahibkara bildiriş göndərildi");
      onChanged();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const needsComment = status === "INFO_REQUESTED" || status === "APPROVED" || status === "REJECTED";

  return (
    <Drawer open onClose={onClose} title={app ? <div><div className="mono faint" style={{ fontSize: 12 }}>{app.applicationNumber}</div><b style={{ font: "650 17px var(--font-display)" }}>{app.applicantName}</b></div> : "Müraciət"}>
      {!app ? <Loading /> : (
        <div className="stack" style={{ ["--gap" as string]: "18px" }}>
          <div className="panel panel--pad">
            <div className="row row--between" style={{ marginBottom: 14 }}>
              <div><b>{app.plotTitle}</b> <span className="mono faint">({app.plotCode})</span><div className="faint" style={{ fontSize: 13 }}>{app.competitionTitle}</div></div>
              <button className="btn btn--sm btn--ghost" onClick={reload}><RefreshCw size={14} /></button>
            </div>
            <StatusFlow status={app.status.code} />
            {app.allowedNext.length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <span className="label">Qərar / növbəti addım</span>
                <div className="row" style={{ margin: "8px 0 12px" }}>
                  {app.allowedNext.map((n) => (
                    <button key={n.code} className={`btn btn--sm ${status === n.code ? "" : "btn--ghost"}`} onClick={() => setStatus(n.code)}>
                      {n.code === "APPROVED" ? <CheckCheck size={15} /> : n.code === "REJECTED" ? <X size={15} /> : n.code === "INFO_REQUESTED" ? <Undo2 size={15} /> : <FileSearch size={15} />} {n.label}
                    </button>
                  ))}
                </div>
                {status && (
                  <>
                    <textarea className="textarea" rows={3} placeholder={needsComment ? "Səbəb / şərh (məcburi)" : "Şərh (istəyə bağlı)"} value={comment} onChange={(e) => setComment(e.target.value)} />
                    <button className="btn" style={{ marginTop: 10 }} disabled={busy || (needsComment && !comment.trim())} onClick={change}>Təsdiq et</button>
                  </>
                )}
              </div>
            ) : app.decisionNote && <div style={{ marginTop: 14 }}><Callout tone={app.status.code === "APPROVED" ? "ok" : "warn"}>{app.decisionNote}</Callout></div>}
          </div>
          <IntegrityPanel signals={app.integrity} />
          <EktisBox app={app} />
          <CommissionPanel app={app} onScored={(u) => { setData(u); onChanged(); }} />
          <ScoreCard app={app} />
          <ApplicationFacts app={app} docBase="/api/v1/admin/applications" />
          <section className="panel"><div className="panel__head"><h3>Tarixçə</h3></div><div className="panel__body"><Timeline app={app} /></div></section>
          <p className="faint" style={{ fontSize: 12 }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> Bu baxış audit jurnalına yazıldı (şəxsi məlumatlara giriş).</p>
        </div>
      )}
    </Drawer>
  );
}

function Applications() {
  const meta = useMeta();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { data, reload } = useApi<ApplicationListItem[]>("/api/v1/admin/applications" + qs({ status, q: dq }));
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="row row--between" style={{ marginBottom: 16 }}>
        <div className="row">
          <input className="input" style={{ width: 280 }} type="search" placeholder="Nömrə, ad, sahə kodu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Axtarış" />
          <select className="select" style={{ width: 240 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">Bütün statuslar</option>
            {meta?.applicationStatuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </div>
        <a className="btn btn--ghost" href="/api/v1/admin/reports/applications.csv"><Download size={16} /> Hesabat (CSV)</a>
      </div>
      <div className="panel table-wrap">
        {!data ? <Loading /> : data.length === 0 ? <Empty title="Müraciət tapılmadı" /> : (
          <table className="table">
            <thead><tr><th>Nömrə</th><th>Sahibkar</th><th>Sahə</th><th className="num">İnvestisiya</th><th className="num">Bal</th><th>Siqnal</th><th>Status</th><th>EKTİS</th><th>Tarix</th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="is-clickable" onClick={() => setOpen(a.id)}>
                  <td className="mono">{a.applicationNumber}</td>
                  <td><div style={{ fontWeight: 600 }}>{a.applicantName}</div><div className="mono faint" style={{ fontSize: 12 }}>{a.taxIdMasked}</div></td>
                  <td><div>{a.plotTitle}</div><div className="faint" style={{ fontSize: 12 }}>{a.district} · {a.activityType.label}</div></td>
                  <td className="num">{money(a.plannedInvestment)}</td>
                  <td className="num"><b style={{ color: a.autoScore >= 80 ? "var(--forest-600)" : a.autoScore >= 60 ? "var(--amber-600)" : "var(--danger)" }}>{a.autoScore}</b></td>
                  <td>{a.signalCount > 0 ? <span className="sig-count" title="Dürüstlük siqnalları">⚠ {a.signalCount}</span> : <span className="faint">yoxdur</span>}</td>
                  <td><Tag label={a.status} /></td>
                  <td><Tag label={a.ektisStatus} /></td>
                  <td>{date(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>Siyahıda FİN/VÖEN maskalanıb. Tam məlumat yalnız müraciət açıldıqda göstərilir və bu baxış audit jurnalına yazılır.</p>
      {open && <ApplicationDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

// ------------------------------------------------------------------ post-award monitoring

function MonitoringTab() {
  const { data, setData } = useApi<Project[]>("/api/v1/admin/monitoring");
  const [open, setOpen] = useState<number | null>(null);
  if (!data) return <Loading />;
  if (!data.length) return <div className="panel"><Empty title="Hələ qalib layihə yoxdur">Müraciət təsdiq edildikdə öhdəlik planı avtomatik yaranır.</Empty></div>;
  const red = data.filter((p) => p.light === "red").length;
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <Callout tone={red ? "danger" : "ok"}>
        Qalib investorların öhdəlikləri: hər layihə üçün 4 mərhələ, son tarix və tələb olunan investisiya payı. Hesabatlar GPS-li fotoyla verilir və sahənin sərhədi ilə yoxlanılır.
        {red > 0 && <b> {red} layihədə gecikmə və ya pozuntu var.</b>}
      </Callout>
      {data.map((p) => (
        <section key={p.applicationId} className="panel">
          <div className="panel__head">
            <div>
              <div className="row" style={{ ["--gap" as string]: "10px" }}><b>{p.plotTitle}</b><span className="mono faint">{p.applicationNumber}</span></div>
              <div className="faint" style={{ fontSize: 12.5 }}>{p.applicantName} · {p.district} · {money(p.plannedInvestment)} · {p.accepted}/{p.total} mərhələ icra olunub · <NextDue project={p} /></div>
            </div>
            <div className="row">
              <Light value={p.light} />
              <button className="btn btn--sm btn--ghost" onClick={() => setOpen(open === p.applicationId ? null : p.applicationId)}>{open === p.applicationId ? "Bağla" : "Mərhələlər"}</button>
            </div>
          </div>
          {open === p.applicationId && (
            <div className="panel__body">
              <MilestoneList project={p} mode="staff" onChange={(u) => setData(data.map((x) => (x.applicationId === u.applicationId ? u : x)))} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ plots

const NUM_FIELDS: [keyof Plot, string, number?][] = [
  ["latitude", "Enlik", 0.0001], ["longitude", "Uzunluq", 0.0001], ["areaHa", "Sahə (ha)", 0.1], ["minInvestment", "Min. investisiya (AZN)", 1000],
  ["leaseYears", "İcarə (il)", 1], ["waterSourceKm", "Suya məsafə (km)", 0.1], ["roadKm", "Yola məsafə (km)", 0.1],
  ["nitrogen", "Azot N", 1], ["phosphorus", "Fosfor P", 1], ["potassium", "Kalium K", 1], ["ph", "pH", 0.1],
  ["avgTemperature", "Temperatur °C", 0.1], ["humidity", "Rütubət %", 1], ["rainfall", "Yağıntı mm", 1],
];

function PlotForm({ plot, onClose, onSaved }: { plot: Plot | null; onClose: () => void; onSaved: () => void }) {
  const meta = useMeta();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(f.entries());
    NUM_FIELDS.forEach(([k]) => (body[k] = Number(body[k])));
    body.irrigationAvailable = f.get("irrigationAvailable") === "on";
    body.electricityAvailable = f.get("electricityAvailable") === "on";
    if (!body.mineClearanceDate) body.mineClearanceDate = null;
    try {
      await api(plot ? `/api/v1/admin/plots/${plot.id}` : "/api/v1/admin/plots", { method: plot ? "PUT" : "POST", body });
      toast(plot ? "Sahə yeniləndi" : "Sahə əlavə edildi");
      onSaved();
    } catch (err) {
      setErrors((err as ApiError).fields ?? {});
      toast((err as Error).message, true);
    }
  };
  const v = (k: keyof Plot) => (plot ? String(plot[k] ?? "") : "");
  return (
    <Drawer open onClose={onClose} title={<b>{plot ? `Sahəni redaktə et · ${plot.code}` : "Yeni sahə"}</b>}>
      <form onSubmit={save} className="panel panel--pad">
        <div className="form-grid">
          <div className="field"><label>Kod</label><input className="input mono" name="code" defaultValue={v("code")} required placeholder="QR-AGD-010" />{errors.code && <span className="error">{errors.code}</span>}</div>
          <div className="field"><label>Kadastr nömrəsi</label><input className="input mono" name="cadastreNumber" defaultValue={v("cadastreNumber")} /></div>
        </div>
        <div className="field"><label>Ad</label><input className="input" name="title" defaultValue={v("title")} required /></div>
        <div className="form-grid form-grid--3">
          <div className="field"><label>Rayon</label><input className="input" name="district" list="districts" defaultValue={v("district")} required /><datalist id="districts">{meta?.districts.map((d) => <option key={d} value={d} />)}</datalist></div>
          <div className="field"><label>Kənd</label><input className="input" name="village" defaultValue={v("village")} /></div>
          <div className="field"><label>Torpaq tipi</label><input className="input" name="soilType" defaultValue={v("soilType")} /></div>
        </div>
        <div className="form-grid form-grid--3">
          <div className="field"><label>Təyinat</label><select className="select" name="activityType" defaultValue={plot?.activityType.code ?? "CROP_FARMING"}>{meta?.activityTypes.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
          <div className="field"><label>Mina statusu</label><select className="select" name="mineClearance" defaultValue={plot?.mineClearance.code ?? "CLEARED"}>{meta?.mineClearance.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
          <div className="field"><label>Təmizlənmə tarixi</label><input className="input" type="date" name="mineClearanceDate" defaultValue={v("mineClearanceDate")} /></div>
        </div>
        <div className="form-grid form-grid--3">
          {NUM_FIELDS.map(([k, label, step]) => (
            <div key={k} className={`field${errors[k] ? " field--invalid" : ""}`}><label>{label}</label><input className="input tabular" type="number" step={step} name={k} defaultValue={v(k)} required />{errors[k] && <span className="error">{errors[k]}</span>}</div>
          ))}
        </div>
        <div className="row" style={{ marginBottom: 16 }}>
          <label className="check"><input type="checkbox" name="irrigationAvailable" defaultChecked={plot?.irrigationAvailable} /> Suvarma var</label>
          <label className="check"><input type="checkbox" name="electricityAvailable" defaultChecked={plot?.electricityAvailable} /> Elektrik var</label>
        </div>
        <div className="field"><label>Təsvir</label><textarea className="textarea" name="description" rows={3} defaultValue={v("description")} /></div>
        <div className="field"><label>İstifadə şərtləri</label><textarea className="textarea" name="usageTerms" rows={3} defaultValue={v("usageTerms")} /></div>
        <button className="btn btn--lg">{plot ? "Yadda saxla" : "Əlavə et"}</button>
      </form>
    </Drawer>
  );
}

function Plots({ isAdmin }: { isAdmin: boolean }) {
  const { data, reload } = useApi<Plot[]>("/api/v1/admin/plots");
  const [edit, setEdit] = useState<Plot | null | "new">(null);
  const toast = useToast();
  const remove = async (p: Plot) => {
    if (!confirm(`${p.code} sahəsi silinsin?`)) return;
    try {
      await api(`/api/v1/admin/plots/${p.id}`, { method: "DELETE" });
      toast("Sahə silindi");
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <>
      <div className="row row--between" style={{ marginBottom: 16 }}>
        <span className="muted">{data?.length ?? 0} sahə</span>
        <button className="btn" onClick={() => setEdit("new")}><Plus size={16} /> Yeni sahə</button>
      </div>
      <div className="panel table-wrap">
        {!data ? <Loading /> : (
          <table className="table">
            <thead><tr><th>Kod</th><th>Ad</th><th>Rayon</th><th className="num">Ərazi</th><th>Mina</th><th>Status</th><th>AI</th><th className="num">Müraciət</th><th /></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td><div style={{ fontWeight: 600 }}>{p.title}</div><div className="faint" style={{ fontSize: 12 }}>{p.activityType.label}</div></td>
                  <td>{p.district}</td>
                  <td className="num">{num(p.areaHa, 1)} ha</td>
                  <td><MineTag label={p.mineClearance} /></td>
                  <td><Tag label={p.status} /></td>
                  <td style={{ fontSize: 13 }}>{p.aiTopCrop ? `${p.aiTopCrop.name} ${pct(p.aiTopCrop.probability)}` : "yoxdur"}</td>
                  <td className="num">{p.applicationCount}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn--sm btn--quiet" onClick={() => setEdit(p)} aria-label="Redaktə"><Pencil size={14} /></button>
                    {isAdmin && <button className="btn btn--sm btn--quiet" onClick={() => remove(p)} aria-label="Sil"><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && <PlotForm plot={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

// ------------------------------------------------------------------ competitions

function CompetitionForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: plots } = useApi<Plot[]>("/api/v1/admin/plots");
  const [selected, setSelected] = useState<number[]>([]);
  const toast = useToast();
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/v1/admin/competitions", { method: "POST", body: { title: f.get("title"), description: f.get("description"), requirements: f.get("requirements"), startDate: f.get("startDate") || null, deadline: f.get("deadline"), plotIds: selected } });
      toast("Qaralama yaradıldı. İndi təsdiqə göndərin.");
      onSaved();
    } catch (err) {
      const ae = err as ApiError;
      toast(ae.fields ? Object.values(ae.fields).join(" · ") : ae.message, true);
    }
  };
  return (
    <Drawer open onClose={onClose} title={<b>Yeni müsabiqə (qaralama)</b>}>
      <form className="panel panel--pad" onSubmit={save}>
        <div className="field"><label>Ad</label><input className="input" name="title" required /></div>
        <div className="field"><label>Təsvir</label><textarea className="textarea" name="description" rows={3} /></div>
        <div className="field"><label>Tələblər</label><textarea className="textarea" name="requirements" rows={3} /></div>
        <div className="form-grid">
          <div className="field"><label>Başlama tarixi</label><input className="input" type="date" name="startDate" /></div>
          <div className="field"><label>Son müraciət tarixi</label><input className="input" type="date" name="deadline" required /></div>
        </div>
        <span className="label">Sahələr ({selected.length} seçilib)</span>
        <div className="panel" style={{ maxHeight: 300, overflow: "auto", margin: "8px 0 18px", boxShadow: "none" }}>
          {plots?.filter((p) => p.status.code !== "ASSIGNED").map((p) => (
            <label key={p.id} className="check" style={{ display: "flex", padding: "9px 14px", borderBottom: "1px solid var(--line)" }}>
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} />
              <span className="mono" style={{ fontSize: 12 }}>{p.code}</span> {p.title} <span className="faint">· {p.district}</span>
            </label>
          ))}
        </div>
        <button className="btn btn--lg" disabled={!selected.length}>Qaralama yarat</button>
      </form>
    </Drawer>
  );
}

function Competitions({ isAdmin, userName }: { isAdmin: boolean; userName: string }) {
  const { data, reload } = useApi<Competition[]>("/api/v1/admin/competitions");
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const act = async (c: Competition, action: string, needsNote?: boolean) => {
    let note: string | null = null;
    if (needsNote) {
      note = prompt("Qeyd / səbəb:");
      if (note === null) return;
    }
    try {
      await api(`/api/v1/admin/competitions/${c.id}/${action}`, { method: "POST", body: needsNote || action === "approve" ? { note } : undefined });
      toast("Əməliyyat icra olundu");
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <>
      <div className="row row--between" style={{ marginBottom: 16 }}>
        <Callout tone="info">Dörd göz prinsipi: müsabiqəni yaradan şəxs onu təsdiq edə bilməz. Elan etmək yalnız başqa administratorun təsdiqi ilə mümkündür.</Callout>
        <button className="btn" onClick={() => setCreating(true)}><Plus size={16} /> Yeni müsabiqə</button>
      </div>
      {!data ? <Loading /> : (
        <div className="stack" style={{ ["--gap" as string]: "12px" }}>
          {data.map((c) => (
            <div key={c.id} className="panel panel--pad">
              <div className="row row--between row--top">
                <div className="grow">
                  <div className="row" style={{ marginBottom: 6 }}><span className="mono faint" style={{ fontSize: 12 }}>{c.code}</span><Tag label={c.status} />{c.open && <Tag tone="gold">{c.daysLeft} gün qalıb</Tag>}</div>
                  <h3>{c.title}</h3>
                  <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
                    {c.plots.length} sahə · son tarix {date(c.deadline)} · {c.applicationCount} müraciət · yaradan: {c.createdBy}{c.approvedBy && ` · təsdiq: ${c.approvedBy}`}
                  </div>
                  {c.reviewNote && <div style={{ marginTop: 8, fontSize: 13 }}><Callout tone="warn">{c.reviewNote}</Callout></div>}
                </div>
                <div className="row">
                  {c.status.code === "DRAFT" && <button className="btn btn--sm" onClick={() => act(c, "submit")}><Send size={14} /> Təsdiqə göndər</button>}
                  {c.status.code === "PENDING_APPROVAL" && isAdmin && c.createdBy !== userName && (
                    <>
                      <button className="btn btn--sm" onClick={() => act(c, "approve")}><ShieldCheck size={14} /> Təsdiq et və elan et</button>
                      <button className="btn btn--sm btn--ghost" onClick={() => act(c, "reject", true)}><RotateCcw size={14} /> Geri qaytar</button>
                    </>
                  )}
                  {c.status.code === "PENDING_APPROVAL" && (!isAdmin || c.createdBy === userName) && <Tag tone="warn">Başqa administratorun təsdiqini gözləyir</Tag>}
                  {c.status.code === "PUBLISHED" && <button className="btn btn--sm btn--ghost" onClick={() => act(c, "close")}>Bağla</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {creating && <CompetitionForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
    </>
  );
}

// ------------------------------------------------------------------ integration

function Integration({ isAdmin }: { isAdmin: boolean }) {
  const { data: events, reload } = useApi<IntegrationEvent[]>("/api/v1/admin/integration/events");
  const { data: mock, reload: reloadMock } = useApi<{ outage: boolean; inbox: { type: string; reference: string; receivedAt: string }[] }>("/api/v1/admin/integration/mock");
  const { data: model, reload: reloadModel } = useApi<ModelInfo>("/api/v1/public/ai/model");
  const [open, setOpen] = useState<IntegrationEvent | null>(null);
  const toast = useToast();
  const refresh = () => { reload(); reloadMock(); };

  const outage = async () => {
    await api(`/api/v1/admin/integration/mock/outage?enabled=${!mock?.outage}`, { method: "POST" });
    toast(mock?.outage ? "EKTİS yenidən əlçatandır, növbədəki hadisələr göndəriləcək" : "EKTİS söndürüldü: yeni hadisələr növbədə qalacaq");
    refresh();
  };
  const retry = async (id: number) => {
    await api(`/api/v1/admin/integration/events/${id}/retry`, { method: "POST" });
    toast("Hadisə yenidən növbəyə qoyuldu");
    reload();
  };
  const reloadAi = async () => {
    await api("/api/v1/admin/ai/reload", { method: "POST" });
    toast("AI modeli diskdən yenidən yükləndi");
    reloadModel();
  };
  const pending = events?.filter((e) => e.status.code === "PENDING").length ?? 0;

  return (
    <div className="stack" style={{ ["--gap" as string]: "20px" }}>
      <div className="grid grid--3">
        <div className="panel panel--pad">
          <div className="metric__label"><Activity size={14} /> EKTİS bağlantısı</div>
          <div className="row" style={{ margin: "10px 0" }}>
            <span className={`tag tag--${mock?.outage ? "danger" : "ok"}`}><span className="dot" /> {mock?.outage ? "Əlçatan deyil (simulyasiya)" : "Aktivdir"}</span>
          </div>
          <p className="faint" style={{ fontSize: 12.5, marginBottom: 12 }}>Demo: EKTİS-i söndürün, müraciət göndərin. Hadisə itmir, növbədə gözləyir və bağlantı bərpa olunanda avtomatik çatdırılır (outbox nümunəsi).</p>
          <button className={`btn btn--sm ${mock?.outage ? "" : "btn--danger"}`} onClick={outage}><Power size={14} /> {mock?.outage ? "EKTİS-i bərpa et" : "EKTİS-i söndür"}</button>
        </div>
        <div className="panel panel--pad">
          <div className="metric__label"><Send size={14} /> Növbədə</div>
          <div className="metric__value">{pending}</div>
          <div className="metric__hint">{events?.filter((e) => e.status.code === "SENT").length ?? 0} göndərilib · {events?.filter((e) => e.direction === "INBOUND").length ?? 0} daxil olub</div>
        </div>
        <div className="panel panel--pad">
          <div className="metric__label"><BrainCircuit size={14} /> AI modeli</div>
          <div style={{ font: "650 16px var(--font-display)", margin: "10px 0 4px" }}>{model?.modelLoaded ? `${model.modelName} v${model.version}` : "Yüklənməyib"}</div>
          <div className="faint" style={{ fontSize: 12.5, marginBottom: 12 }}>{model?.metrics ? `Test dəqiqliyi ${pct1(model.metrics.test_accuracy)}` : "Fallback alqoritm"}</div>
          {isAdmin && <button className="btn btn--sm btn--ghost" onClick={reloadAi}><RefreshCw size={14} /> Modeli yenidən yüklə</button>}
        </div>
      </div>
      <section className="panel">
        <div className="panel__head"><h3>İnteqrasiya jurnalı (outbox / inbox)</h3><button className="btn btn--sm btn--ghost" onClick={refresh}><RefreshCw size={14} /> Yenilə</button></div>
        <div className="table-wrap">
          {!events ? <Loading /> : events.length === 0 ? <Empty title="Hələ hadisə yoxdur" /> : (
            <table className="table">
              <thead><tr><th>İstiqamət</th><th>Hadisə</th><th>Obyekt</th><th>Status</th><th className="num">Cəhd</th><th>EKTİS istinadı</th><th>Vaxt</th><th /></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="is-clickable" onClick={() => setOpen(e)}>
                    <td><Tag tone={e.direction === "OUTBOUND" ? "info" : "gold"}>{e.direction === "OUTBOUND" ? "→ EKTİS" : "← EKTİS"}</Tag></td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{e.eventType}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{e.aggregateId}</td>
                    <td><Tag label={e.status} /></td>
                    <td className="num">{e.attempts}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{e.externalReference ?? "yoxdur"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{dateTime(e.createdAt)}</td>
                    <td>{e.status.code === "FAILED" && <button className="btn btn--sm btn--ghost" onClick={(ev) => { ev.stopPropagation(); retry(e.id); }}>Yenidən</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {open && (
        <Drawer open onClose={() => setOpen(null)} title={<b className="mono">{open.eventType}</b>}>
          <div className="stack" style={{ ["--gap" as string]: "14px" }}>
            {open.lastError && <Callout tone="danger">{open.lastError}</Callout>}
            <span className="label">Payload (JSON, schemaVersion 1.0)</span>
            <pre className="code">{JSON.stringify(JSON.parse(open.payload), null, 2)}</pre>
          </div>
        </Drawer>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ audit

function Audit() {
  const { data } = useApi<AuditEntry[]>("/api/v1/admin/audit");
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => data?.filter((a) => !filter || a.action === filter) ?? [], [data, filter]);
  const actions = useMemo(() => [...new Set(data?.map((a) => a.action))].sort(), [data]);
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <select className="select" style={{ width: 300 }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Əməliyyat">
          <option value="">Bütün əməliyyatlar</option>
          {actions.map((a) => <option key={a}>{a}</option>)}
        </select>
        <span className="faint" style={{ fontSize: 13 }}>Son 200 qeyd · dəyişdirilə bilməz</span>
      </div>
      <div className="panel table-wrap">
        {!data ? <Loading /> : (
          <table className="table table--compact">
            <thead><tr><th>Vaxt</th><th>İstifadəçi</th><th>Əməliyyat</th><th>Obyekt</th><th>Təfərrüat</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{dateTime(a.createdAt)}</td>
                  <td>{a.actor}</td>
                  <td><Tag tone={a.action.includes("FAILED") ? "danger" : a.action.includes("PII") || a.action.includes("DOCUMENT") ? "warn" : "muted"}>{a.action}</Tag></td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.entityType}{a.entityId && ` #${a.entityId}`}</td>
                  <td style={{ fontSize: 13 }}>{a.details}</td>
                  <td className="mono faint" style={{ fontSize: 12 }}>{a.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ page

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState<TabKey>("overview");
  useDocumentTitle("İnzibati panel");
  const tabs: { key: TabKey; label: string; icon: typeof Gauge; adminOnly?: boolean }[] = [
    { key: "overview", label: "İcmal", icon: Gauge },
    { key: "applications", label: "Müraciətlər", icon: ClipboardList },
    { key: "monitoring", label: "Öhdəliklərin monitorinqi", icon: Activity },
    { key: "plots", label: "Sahələr", icon: MapPinned },
    { key: "competitions", label: "Müsabiqələr", icon: Trophy },
    { key: "integration", label: "EKTİS və AI", icon: Activity },
    { key: "audit", label: "Audit jurnalı", icon: History, adminOnly: true },
  ];
  return (
    <>
      <section className="band">
        <div className="wrap row row--between">
          <div>
            <h1>İnzibati idarəetmə paneli</h1>
            <p>{user?.fullName} · {user?.roleLabel}</p>
          </div>
        </div>
      </section>
      <div className="wrap page">
        <div className="tabs" role="tablist">
          {tabs.filter((t) => !t.adminOnly || isAdmin).map(({ key, label, icon: Icon }) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}><Icon size={16} /> {label}</button>
          ))}
        </div>
        {tab === "overview" && <Overview go={setTab} />}
        {tab === "applications" && <Applications />}
        {tab === "monitoring" && <MonitoringTab />}
        {tab === "plots" && <Plots isAdmin={isAdmin} />}
        {tab === "competitions" && <Competitions isAdmin={isAdmin} userName={user?.fullName ?? ""} />}
        {tab === "integration" && <Integration isAdmin={isAdmin} />}
        {tab === "audit" && isAdmin && <Audit />}
      </div>
    </>
  );
}
