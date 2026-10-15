import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Fingerprint, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api, ApiError } from "../lib/api";
import { Callout, useToast } from "../components/ui";
import { useDocumentTitle } from "../lib/hooks";

const RULES: [string, (p: string) => boolean][] = [
  ["Ən azı 8 simvol", (p) => p.length >= 8],
  ["Ən azı bir hərf", (p) => /[A-Za-z]/.test(p)],
  ["Ən azı bir rəqəm", (p) => /\d/.test(p)],
];

export default function Login() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"login" | "register">(params.get("tab") === "register" ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("mygov") === "denied" ? "myGov ilə giriş ləğv edildi." : null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const { login, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  useDocumentTitle(tab === "login" ? "Daxil ol" : "Qeydiyyat");
  const next = params.get("next");

  const done = (role: string) => nav(next && next.startsWith("/") ? next : role === "INVESTOR" ? "/kabinet" : "/admin", { replace: true });

  const myGov = async () => {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/v1/auth/mygov/start");
      try {
        if (next) sessionStorage.setItem("mygov-next", next);
      } catch {
        /* storage unavailable */
      }
      location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFields({});
    try {
      if (tab === "login") {
        const u = await login(String(f.get("email")), String(f.get("password")));
        toast(`Xoş gəlmisiniz, ${u.fullName}`);
        done(u.role);
      } else {
        await api("/api/v1/auth/register", {
          method: "POST",
          body: {
            fullName: String(f.get("fullName")).trim(),
            email: String(f.get("email")).trim(),
            phone: String(f.get("phone") ?? "").trim(),
            password,
          },
        });
        const u = await refresh();
        toast("Hesabınız yaradıldı");
        done(u?.role ?? "INVESTOR");
      }
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message);
      setFields(ae.fields ?? {});
    } finally {
      setBusy(false);
    }
  };

  const fieldErr = (k: string) => fields[k] && <span className="error">{fields[k]}</span>;
  const cls = (k: string) => `field${fields[k] ? " field--invalid" : ""}`;
  const passOk = RULES.every(([, ok]) => ok(password));

  return (
    <div className="wrap page" style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 32 }}>{tab === "login" ? "Portala daxil olun" : "Qeydiyyat"}</h1>
      <p className="muted" style={{ margin: "8px 0 24px" }}>
        {tab === "login" ? "Müraciət etmək və statusu izləmək üçün hesabınıza daxil olun." : "Hesab yaratdıqdan sonra açıq müsabiqələrə elektron müraciət edə bilərsiniz."}
      </p>

      <button className="btn btn--lg btn--block mygov-btn" onClick={myGov} disabled={busy}>
        <Fingerprint size={20} /> myGov ilə {tab === "login" ? "daxil ol" : "qeydiyyatdan keç"}
      </button>
      <p className="faint" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
        Tövsiyə olunur: şəxsiyyətiniz dövlət sistemi ilə təsdiqlənir, FİN və telefon avtomatik doldurulur. Demo versiyada simulyasiya provayderi işləyir.
      </p>

      <div className="or"><span>və ya e-poçt ilə</span></div>

      {error && <div style={{ marginBottom: 16 }}><Callout tone="danger">{error}</Callout></div>}

      <form onSubmit={submit}>
        {tab === "register" && (
          <div className={cls("fullName")}>
            <label htmlFor="fullName">Ad və soyad</label>
            <input className="input" id="fullName" name="fullName" required maxLength={150} autoComplete="name" />
            {fieldErr("fullName")}
          </div>
        )}
        <div className={cls("email")}>
          <label htmlFor="email">E-poçt</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          {fieldErr("email")}
        </div>
        {tab === "register" && (
          <div className="form-grid">
            <div className={cls("phone")}>
              <label htmlFor="phone">Mobil nömrə</label>
              <input className="input" id="phone" name="phone" type="tel" placeholder="+994 50 000 00 00" autoComplete="tel" />
              {fieldErr("phone")}
            </div>
          </div>
        )}
        <div className={cls("password")}>
          <label htmlFor="password">Şifrə</label>
          <input className="input" id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === "login" ? "current-password" : "new-password"} />
          {tab === "register" && (
            <ul className="rules">
              {RULES.map(([t, ok]) => (
                <li key={t} className={ok(password) ? "is-ok" : ""}>{ok(password) ? <Check size={14} /> : <X size={14} />} {t}</li>
              ))}
            </ul>
          )}
          {fieldErr("password")}
        </div>
        <button className="btn btn--lg btn--block btn--ghost" disabled={busy || (tab === "register" && !passOk)}>
          {busy ? "Gözləyin…" : tab === "login" ? "Daxil ol" : "Hesab yarat"}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 14 }}>
        {tab === "login"
          ? <>Hesabınız yoxdur? <button className="linklike" onClick={() => { setTab("register"); setError(null); }}>Qeydiyyatdan keçin</button></>
          : <>Artıq hesabınız var? <button className="linklike" onClick={() => { setTab("login"); setError(null); }}>Daxil olun</button></>}
      </p>
      <p className="faint" style={{ fontSize: 12.5, marginTop: 24 }}>
        5 uğursuz cəhddən sonra hesab 10 dəqiqəlik bloklanır. Girişlər audit jurnalına yazılır. Demo hesablar README faylındadır. <Link to="/">Əsas səhifə</Link>
      </p>
    </div>
  );
}
