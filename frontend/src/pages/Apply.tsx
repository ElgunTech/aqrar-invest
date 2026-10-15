import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, CircleAlert, DatabaseZap, FileText, PartyPopper, Send, Upload, User as UserIcon,
  Globe2,
} from "lucide-react";
import { Callout, Empty, Loading, MineTag, Tag, useToast } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { countdown, date, fileSize, money, num, fit } from "../lib/format";
import { useApi, useDocumentTitle, useMeta } from "../lib/hooks";
import { useT } from "../lib/i18n";
import type { Competition, CropRecommendation, Plot } from "../lib/types";

type ApplicantKind = "INDIVIDUAL" | "COMPANY" | "FOREIGN";
/** Identifier rule per applicant type: FİN, VÖEN or passport number. */
const ID_RULE: Record<ApplicantKind, { re: RegExp; label: string; hint: string; error: string; max: number }> = {
  INDIVIDUAL: { re: /^[A-Za-z0-9]{7}$/, label: "FİN kod", hint: "7 simvol", error: "FİN 7 simvoldan ibarət olmalıdır", max: 7 },
  COMPANY: { re: /^\d{10}$/, label: "VÖEN", hint: "10 rəqəm", error: "VÖEN 10 rəqəmdən ibarət olmalıdır", max: 10 },
  FOREIGN: { re: /^[A-Za-z0-9]{6,12}$/, label: "Pasport nömrəsi", hint: "6–12 hərf və rəqəm", error: "Pasport nömrəsi 6–12 hərf və rəqəmdən ibarət olmalıdır", max: 12 },
};

interface Form {
  applicantType: ApplicantKind;
  citizenship: string;
  applicantName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  activityType: string;
  plannedCrop: string;
  plannedInvestment: string;
  ownFundsPercent: string;
  jobsCreated: string;
  returneeJobs: string;
  projectMonths: string;
  experienceYears: string;
  businessPlan: string;
}

const STEPS = ["Sahə", "Müraciətçi", "Biznes plan", "Sənədlər", "Təsdiq"];
const DOCS = [
  { type: "BUSINESS_PLAN", label: "Biznes plan", required: () => true },
  { type: "ID_DOCUMENT", label: "Şəxsiyyət vəsiqəsi", required: () => true },
  { type: "REGISTRATION_CERT", label: "Dövlət qeydiyyatı şəhadətnaməsi", required: (f: Form) => f.applicantType === "COMPANY" },
  { type: "FINANCIAL_PROOF", label: "Maliyyə imkanını təsdiq edən sənəd", required: () => false },
];
const ALLOWED = /\.(pdf|jpe?g|png|docx)$/i;

export default function Apply() {
  useDocumentTitle("Elektron müraciət");
  const [params] = useSearchParams();
  const plotId = params.get("plot");
  const competitionId = params.get("competition");
  const { user } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const { t } = useT();
  const { data: plot, error: plotErr } = useApi<Plot>(plotId ? `/api/v1/public/plots/${plotId}` : null);
  const { data: comp } = useApi<Competition>(competitionId ? `/api/v1/public/competitions/${competitionId}` : null);
  const { data: rec } = useApi<CropRecommendation>(plotId ? `/api/v1/public/plots/${plotId}/recommendation` : null);

  const draftKey = `draft:${plotId}:${competitionId}`;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(() => {
    const base: Form = {
      applicantType: "INDIVIDUAL", citizenship: "", applicantName: user?.fullName ?? "", taxId: user?.taxId ?? "", phone: user?.phone ?? "", email: user?.email ?? "", address: "",
      activityType: "", plannedCrop: "", plannedInvestment: "", ownFundsPercent: "30", jobsCreated: "", returneeJobs: "", projectMonths: "36", experienceYears: "", businessPlan: "",
    };
    try {
      const saved = localStorage.getItem(draftKey);
      return saved ? { ...base, ...JSON.parse(saved) } : base;
    } catch {
      return base;
    }
  });
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [registry, setRegistry] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<{ id: number; applicationNumber: string; autoScore: number } | null>(null);

  useEffect(() => {
    if (plot && !form.activityType) setForm((f) => ({ ...f, activityType: plot.activityType.code }));
    if (rec && !form.plannedCrop && rec.recommendations[0]) setForm((f) => ({ ...f, plannedCrop: rec.recommendations[0].code }));
  }, [plot, rec]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {
      /* storage unavailable; the draft is a convenience only */
    }
  }, [form, draftKey]);

  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const missingDocs = DOCS.filter((d) => d.required(form) && !files[d.type]).map((d) => t(d.label));

  const validate = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.applicantName.trim()) e.applicantName = t("Ad tələb olunur");
      if (!ID_RULE[form.applicantType].re.test(form.taxId.trim())) e.taxId = t(ID_RULE[form.applicantType].error);
      if (form.applicantType === "FOREIGN" && !form.citizenship.trim()) e.citizenship = t("Vətəndaşlığı göstərin");
      if (!/^[+0-9 ()-]{9,20}$/.test(form.phone.trim())) e.phone = t("Telefon nömrəsi yanlışdır");
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = t("E-poçt yanlışdır");
    }
    if (s === 2) {
      if (!(Number(form.plannedInvestment) > 0)) e.plannedInvestment = t("Məbləğ daxil edin");
      if (form.jobsCreated === "" || Number(form.jobsCreated) < 0) e.jobsCreated = t("İş yerlərinin sayını daxil edin");
      if (form.experienceYears === "" || Number(form.experienceYears) < 0) e.experienceYears = t("Təcrübəni daxil edin");
      if (!(Number(form.projectMonths) >= 1)) e.projectMonths = t("Müddəti daxil edin");
      if (Number(form.returneeJobs || 0) > Number(form.jobsCreated || 0)) e.returneeJobs = t("Ümumi iş yerlərindən çox ola bilməz");
      if (form.businessPlan.trim().length < 100) e.businessPlan = t("Biznes planın xülasəsi ən azı 100 simvol olmalıdır");
    }
    if (s === 3 && missingDocs.length) e.docs = t("Çatışmayan sənədlər:") + " " + missingDocs.join(", ");
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const lookupRegistry = async () => {
    setRegistry(t("Yoxlanılır…"));
    try {
      const r = await api<{ found: boolean; unavailable?: boolean; farmer?: { fullName: string; district: string; registeredLandHa: number; farmerSince: number } }>(`/api/v1/me/registry/${encodeURIComponent(form.taxId.trim())}`);
      if (r.found && r.farmer) {
        setForm((f) => ({ ...f, applicantName: r.farmer!.fullName, applicantType: /^\d{10}$/.test(f.taxId.trim()) ? "COMPANY" : "INDIVIDUAL", experienceYears: String(new Date().getFullYear() - r.farmer!.farmerSince) }));
        setRegistry(t("EKTİS fermer reyestrində tapıldı: {name}, {district}, {ha} ha qeydiyyatlı torpaq. Məlumatlar dolduruldu.", { name: r.farmer.fullName, district: r.farmer.district, ha: r.farmer.registeredLandHa }));
      } else {
        setRegistry(t(r.unavailable ? "EKTİS hazırda əlçatan deyil, məlumatları əl ilə daxil edin." : "Reyestrdə tapılmadı. Müraciətdən sonra EKTİS-də ilkin qeydiyyat avtomatik yaradılacaq."));
      }
    } catch (e) {
      setRegistry((e as Error).message);
    }
  };

  const submit = async () => {
    if (!plot || !comp) return;
    setBusy(true);
    try {
      const data = {
        competitionId: comp.id, plotId: plot.id, applicantType: form.applicantType, applicantName: form.applicantName.trim(), taxId: form.taxId.trim(),
        citizenship: form.applicantType === "FOREIGN" ? form.citizenship.trim() : null,
        phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(), activityType: form.activityType, plannedCrop: form.plannedCrop || null,
        plannedInvestment: Number(form.plannedInvestment), ownFundsPercent: Number(form.ownFundsPercent), jobsCreated: Number(form.jobsCreated), returneeJobs: Number(form.returneeJobs || 0),
        projectMonths: Number(form.projectMonths), experienceYears: Number(form.experienceYears), businessPlan: form.businessPlan.trim(),
      };
      const fd = new FormData();
      fd.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
      Object.entries(files).forEach(([type, file]) => {
        if (file) {
          fd.append("files", file);
          fd.append("types", type);
        }
      });
      const r = await api<{ id: number; applicationNumber: string; autoScore: number }>("/api/v1/me/applications", { method: "POST", form: fd });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setResult(r);
      window.scrollTo({ top: 0 });
    } catch (e) {
      const ae = e as ApiError;
      toast(ae.message, true);
      if (ae.fields) setErrors(ae.fields);
    } finally {
      setBusy(false);
    }
  };

  const cropName = useMemo(() => meta?.crops.find((c) => c.code === form.plannedCrop)?.label, [meta, form.plannedCrop]);
  const aiRank = rec?.recommendations.findIndex((c) => c.code === form.plannedCrop) ?? -1;

  if (!plotId || !competitionId || plotErr) {
    return <div className="wrap page"><div className="panel"><Empty title={t("Sahə seçilməyib")}>{t("Müraciət etmək üçün əvvəlcə kataloqdan açıq müsabiqədə olan sahəni seçin.")}<br /><Link className="btn" to="/kataloq" style={{ marginTop: 14 }}>{t("Kataloqa keç")}</Link></Empty></div></div>;
  }
  if (!plot || !comp) return <Loading />;

  if (result) {
    return (
      <div className="wrap page" style={{ maxWidth: 760 }}>
        <div className="panel panel--pad rise" style={{ textAlign: "center", padding: 48 }}>
          <PartyPopper size={44} color="#d9a23a" style={{ margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 30 }}>{t("Müraciətiniz qəbul edildi")}</h1>
          <p className="muted" style={{ marginTop: 10 }}>{t("Qeydiyyat nömrəsi")}</p>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700, margin: "6px 0 18px", color: "var(--forest-700)" }}>{result.applicationNumber}</div>
          <Callout tone="info">{t("Müraciət bir neçə saniyə ərzində EKTİS-ə ötürülür və fermer reyestrində yoxlanılır. Nəticəni şəxsi kabinetdə izləyə bilərsiniz.")}</Callout>
          <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
            <Link className="btn btn--lg" to={`/kabinet/${result.id}`}>{t("Statusu izlə")} <ArrowRight size={18} /></Link>
            <Link className="btn btn--lg btn--ghost" to={`/kabinet/${result.id}/qebz`}>{t("Qəbzi yüklə")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <span className="error">{errors[k]}</span>;
  const cls = (k: string) => `field${errors[k] ? " field--invalid" : ""}`;

  return (
    <>
      <section className="band">
        <div className="wrap">
          <nav className="crumbs"><Link to={`/sahe/${plot.id}`}>{plot.title}</Link> / <span>{t("Elektron müraciət")}</span></nav>
          <h1>{t("Elektron müraciət")}</h1>
          <p>{comp.title} · {t("son tarix")} {date(comp.deadline)} ({countdown(comp.deadline)} {t("qalıb")}). {t("Qaralama avtomatik saxlanılır.")}</p>
        </div>
      </section>
      <div className="wrap page">
        <ol className="steps" style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
          {STEPS.map((s, i) => (
            <li key={s} className={`steps__item${i < step ? " steps__item--done" : i === step ? " steps__item--current" : ""}`} aria-current={i === step ? "step" : undefined}>
              <i>{i < step ? "✓" : i + 1}</i><span>{t(s)}</span>
            </li>
          ))}
        </ol>

        <div className="layout-2">
          <div className="panel panel--pad">
            {step === 0 && (
              <div className="rise">
                <h2 style={{ fontSize: 22, marginBottom: 16 }}>{t("Sahə və fəaliyyət")}</h2>
                <dl className="kv" style={{ marginBottom: 22 }}>
                  <dt>{t("Sahə")}</dt><dd>{plot.title} <span className="mono faint">({plot.code})</span></dd>
                  <dt>{t("Yerləşmə")}</dt><dd>{plot.district}, {plot.village}</dd>
                  <dt>{t("Ərazi")}</dt><dd>{num(plot.areaHa, 1)} ha · {t("icarə {n} il", { n: plot.leaseYears })}</dd>
                  <dt>{t("Minimum investisiya")}</dt><dd>{money(plot.minInvestment)}</dd>
                  <dt>{t("Minadan təmizlənmə")}</dt><dd><MineTag label={plot.mineClearance} /></dd>
                </dl>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="act">{t("Fəaliyyət istiqaməti")}</label>
                    <select id="act" className="select" value={form.activityType} onChange={set("activityType")}>
                      {meta?.activityTypes.map((a) => <option key={a.code} value={a.code}>{t(a.label)}</option>)}
                    </select>
                    {form.activityType && form.activityType !== plot.activityType.code && <span className="hint" style={{ color: "var(--warn)" }}>{t("Sahənin təyinatı:")} {t(plot.activityType.label)}. {t("Uyğunsuzluq balı azaldır.")}</span>}
                  </div>
                  <div className="field">
                    <label htmlFor="crop">{t("Planlaşdırılan bitki")}</label>
                    <select id="crop" className="select" value={form.plannedCrop} onChange={set("plannedCrop")}>
                      <option value="">{t("Bitki deyil (heyvandarlıq və s.)")}</option>
                      {meta?.crops.map((c) => <option key={c.code} value={c.code}>{t(c.label)}</option>)}
                    </select>
                  </div>
                </div>
                {rec && (
                  <div className="ai-line" style={{ alignItems: "flex-start" }}>
                    
                    <span>
                      {t("AI bu torpaq üçün tövsiyə edir:")} <b>{rec.recommendations.map((c) => `${t(c.name)} (${t(fit(c.probability))})`).slice(0, 3).join(", ")}</b>.{" "}
                      {form.plannedCrop && (aiRank === 0 ? <b>{t("Seçiminiz ən uyğun variantdır.")}</b> : aiRank > 0 ? t("Seçiminiz ilk üçlükdədir.") : t("{crop} bu torpaq üçün optimal deyil, bu avtomatik balı azalda bilər.", { crop: cropName ? t(cropName) : t("Seçilmiş bitki") }))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="rise">
                <h2 style={{ fontSize: 22, marginBottom: 16 }}>{t("Müraciətçi haqqında")}</h2>
                <div className="segmented" role="group" aria-label={t("Müraciətçinin növü")} style={{ marginBottom: 18 }}>
                  <button type="button" aria-pressed={form.applicantType === "INDIVIDUAL"} onClick={() => setForm({ ...form, applicantType: "INDIVIDUAL" })}><UserIcon size={14} style={{ verticalAlign: -2 }} /> {t("Fiziki şəxs")}</button>
                  <button type="button" aria-pressed={form.applicantType === "COMPANY"} onClick={() => setForm({ ...form, applicantType: "COMPANY" })}><Building2 size={14} style={{ verticalAlign: -2 }} /> {t("Hüquqi şəxs")}</button>
                  <button type="button" aria-pressed={form.applicantType === "FOREIGN"} onClick={() => setForm({ ...form, applicantType: "FOREIGN" })}><Globe2 size={14} style={{ verticalAlign: -2 }} /> {t("Xarici vətəndaş")}</button>
                </div>
                <div className={cls("taxId")}>
                  <label htmlFor="tax">{t(ID_RULE[form.applicantType].label)}</label>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <input id="tax" className="input mono" value={form.taxId} onChange={set("taxId")} maxLength={ID_RULE[form.applicantType].max} placeholder={t(ID_RULE[form.applicantType].hint)} style={{ textTransform: "uppercase" }} />
                    <button type="button" className="btn btn--ghost" onClick={lookupRegistry} hidden={form.applicantType === "FOREIGN"} disabled={!ID_RULE[form.applicantType].re.test(form.taxId.trim())}><DatabaseZap size={16} /> {t("EKTİS-dən doldur")}</button>
                  </div>
                  {err("taxId")}
                  {registry && <span className="hint" style={{ color: "var(--info)" }}>{registry}</span>}
                </div>
                {form.applicantType === "FOREIGN" && (
                  <div className={cls("citizenship")}>
                    <label htmlFor="cit">{t("Vətəndaşlıq")}</label>
                    <input id="cit" className="input" value={form.citizenship} onChange={set("citizenship")} maxLength={60} placeholder={t("məs. Türkiyə")} />{err("citizenship")}
                  </div>
                )}
                <div className={cls("applicantName")}>
                  <label htmlFor="name">{t(form.applicantType === "COMPANY" ? "Şirkətin adı" : form.applicantType === "FOREIGN" ? "Ad və soyad (pasportdakı kimi)" : "Ad, soyad, ata adı")}</label>
                  <input id="name" className="input" value={form.applicantName} onChange={set("applicantName")} />{err("applicantName")}
                </div>
                <div className="form-grid">
                  <div className={cls("phone")}><label htmlFor="ph">{t("Telefon")}</label><input id="ph" className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+994 50 000 00 00" />{err("phone")}</div>
                  <div className={cls("email")}><label htmlFor="em">{t("E-poçt")}</label><input id="em" className="input" type="email" value={form.email} onChange={set("email")} />{err("email")}</div>
                </div>
                <div className="field"><label htmlFor="ad">{t("Ünvan")}</label><input id="ad" className="input" value={form.address} onChange={set("address")} /></div>
              </div>
            )}

            {step === 2 && (
              <div className="rise">
                <h2 style={{ fontSize: 22, marginBottom: 16 }}>{t("İnvestisiya və biznes plan")}</h2>
                <div className="form-grid">
                  <div className={cls("plannedInvestment")}>
                    <label htmlFor="inv">{t("Planlaşdırılan investisiya (AZN)")}</label>
                    <input id="inv" className="input tabular" type="number" min={1} step={1000} value={form.plannedInvestment} onChange={set("plannedInvestment")} />
                    <span className="hint">{t("Minimum:")} {money(plot.minInvestment)}</span>{err("plannedInvestment")}
                  </div>
                  <div className="field">
                    <label htmlFor="own">{t("Öz vəsaitinin payı:")} {form.ownFundsPercent}%</label>
                    <input id="own" className="range" type="range" min={0} max={100} step={5} value={form.ownFundsPercent} onChange={set("ownFundsPercent")} />
                  </div>
                </div>
                <div className="form-grid form-grid--3">
                  <div className={cls("jobsCreated")}><label htmlFor="jobs">{t("Yeni iş yerləri")}</label><input id="jobs" className="input" type="number" min={0} value={form.jobsCreated} onChange={set("jobsCreated")} />{err("jobsCreated")}</div>
                  <div className={cls("projectMonths")}><label htmlFor="mon">{t("Layihə müddəti (ay)")}</label><input id="mon" className="input" type="number" min={1} value={form.projectMonths} onChange={set("projectMonths")} />{err("projectMonths")}</div>
                  <div className={cls("experienceYears")}><label htmlFor="exp">{t("Aqrar təcrübə (il)")}</label><input id="exp" className="input" type="number" min={0} value={form.experienceYears} onChange={set("experienceYears")} />{err("experienceYears")}</div>
                </div>
                <div className={cls("returneeJobs")}>
                  <label htmlFor="ret">{t("Böyük Qayıdış: bu iş yerlərindən neçəsi qayıdan sakinlər üçündür?")}</label>
                  <input id="ret" className="input" type="number" min={0} value={form.returneeJobs} onChange={set("returneeJobs")} style={{ maxWidth: 220 }} />
                  <span className="hint">{t("İşğaldan azad edilmiş ərazilərə qayıdan keçmiş məcburi köçkünlərin işlə təmini ayrıca meyar kimi qiymətləndirilir.")}</span>{err("returneeJobs")}
                </div>
                <div className={cls("businessPlan")}>
                  <label htmlFor="bp">{t("Biznes planın xülasəsi")}</label>
                  <textarea id="bp" className="textarea" rows={8} maxLength={6000} value={form.businessPlan} onChange={set("businessPlan")}
                    placeholder={t("Məqsəd, mərhələlər, texnologiya (məs. damcı suvarma), satış bazarı, iş yerləri, risklər...")} />
                  <span className="hint">{form.businessPlan.trim().length} / 6000 {t("simvol · ən azı 100")}</span>{err("businessPlan")}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="rise">
                <h2 style={{ fontSize: 22, marginBottom: 6 }}>{t("Sənədlər")}</h2>
                <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>{t("PDF, JPG, PNG və ya DOCX, hər biri 5 MB-a qədər. Server faylın həqiqi formatını da yoxlayır.")}</p>
                <div className="stack" style={{ ["--gap" as string]: "12px" }}>
                  {DOCS.map((d) => {
                    const file = files[d.type];
                    const req = d.required(form);
                    return (
                      <label key={d.type} className={`upload${file ? " upload--done" : ""}`} style={{ cursor: "pointer" }}>
                        <span className="upload__icon">{file ? <CheckCircle2 size={20} /> : <Upload size={20} />}</span>
                        <span className="grow">
                          <div style={{ fontWeight: 600 }}>{t(d.label)} {req ? <Tag tone="danger">{t("məcburi")}</Tag> : <Tag tone="muted">{t("tövsiyə")}</Tag>}</div>
                          {file ? <div className="upload__file">{file.name} · {fileSize(file.size)}</div> : <div className="faint" style={{ fontSize: 13 }}>{t("Fayl seçmək üçün klikləyin")}</div>}
                        </span>
                        <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.docx"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (!ALLOWED.test(f.name)) return toast(t("İcazə verilən formatlar: PDF, JPG, PNG, DOCX"), true);
                            if (f.size > 5 * 1024 * 1024) return toast(t("Fayl 5 MB-dan böyük ola bilməz"), true);
                            setFiles((x) => ({ ...x, [d.type]: f }));
                          }} />
                        <span className="btn btn--sm btn--ghost" aria-hidden>{t(file ? "Dəyiş" : "Seç")}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.docs && <div style={{ marginTop: 14 }}><Callout tone="danger">{errors.docs}</Callout></div>}
              </div>
            )}

            {step === 4 && (
              <div className="rise">
                <h2 style={{ fontSize: 22, marginBottom: 16 }}>{t("Yoxlayın və göndərin")}</h2>
                <dl className="kv">
                  <dt>{t("Müraciətçi")}</dt><dd>{form.applicantName} · <span className="mono">{form.taxId.toUpperCase()}</span></dd>
                  <dt>{t("Əlaqə")}</dt><dd>{form.phone} · {form.email}</dd>
                  <dt>{t("Fəaliyyət / bitki")}</dt><dd>{t(meta?.activityTypes.find((a) => a.code === form.activityType)?.label ?? "")} {cropName && `· ${t(cropName)}`}</dd>
                  <dt>{t("İnvestisiya")}</dt><dd>{money(Number(form.plannedInvestment))} · {t("öz vəsaiti")} {form.ownFundsPercent}%</dd>
                  <dt>{t("İş yerləri / müddət")}</dt><dd>{t("{jobs} iş yeri ({ret} qayıdan sakinlər üçün) · {months} ay", { jobs: form.jobsCreated, ret: form.returneeJobs || 0, months: form.projectMonths })}</dd>
                  <dt>{t("Sənədlər")}</dt><dd>{Object.values(files).filter(Boolean).length} {t("fayl")}</dd>
                </dl>
                <hr className="divider" />
                <label className="check" style={{ alignItems: "flex-start" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{t("Təqdim etdiyim məlumatların doğruluğunu təsdiq edirəm və şəxsi məlumatlarımın müsabiqə məqsədilə emalına, həmçinin EKTİS-ə ötürülməsinə razılıq verirəm.")}</span>
                </label>
              </div>
            )}

            <hr className="divider" />
            <div className="row row--between">
              <button className="btn btn--ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft size={16} /> {t("Geri")}</button>
              {step < 4
                ? <button className="btn" onClick={next}>{t("Davam et")} <ArrowRight size={16} /></button>
                : <button className="btn btn--lg btn--amber" onClick={submit} disabled={!consent || busy}><Send size={17} /> {t(busy ? "Göndərilir…" : "Müraciəti göndər")}</button>}
            </div>
          </div>

          <aside className="sticky stack" style={{ ["--gap" as string]: "16px" }}>
            <div className="panel panel--pad">
              <h3 style={{ marginBottom: 10 }}>{t("Tamlıq yoxlaması")}</h3>
              <ul className="checklist">
                {[
                  [t("Sahə və fəaliyyət seçilib"), !!form.activityType],
                  [t("{id} düzgündür", { id: t(ID_RULE[form.applicantType].label) }), ID_RULE[form.applicantType].re.test(form.taxId.trim())],
                  [t("Əlaqə məlumatları"), !!form.phone && !!form.email],
                  [`${t("İnvestisiya")} ≥ ${money(plot.minInvestment)}`, Number(form.plannedInvestment) >= plot.minInvestment],
                  [t("Biznes plan (100+ simvol)"), form.businessPlan.trim().length >= 100],
                  [t("Məcburi sənədlər"), missingDocs.length === 0],
                ].map(([label, ok]) => (
                  <li key={String(label)}>{ok ? <CheckCircle2 color="#26775a" /> : <CircleAlert color="#b9851f" />} <span className={ok ? "" : "muted"}>{label}</span></li>
                ))}
              </ul>
            </div>
            <div className="panel panel--pad" style={{ fontSize: 13.5 }}>
              <h3 style={{ marginBottom: 8 }}><FileText size={16} style={{ verticalAlign: -2 }} /> {t("Necə qiymətləndirilir?")}</h3>
              <p className="muted">{t("Göndərdikdən sonra sistem izah olunan ilkin bal hesablayır: investisiya həcmi, öz vəsaiti, iş yerləri, təcrübə, təyinata uyğunluq və AI-nin bitki uyğunluğu. Qərarı komissiya verir.")}</p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
