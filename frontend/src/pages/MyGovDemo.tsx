import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Fingerprint, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";
import { useDocumentTitle } from "../lib/hooks";

interface Citizen {
  fin: string;
  name: string;
  phone: string;
}

/**
 * Simulated consent screen of the national identity provider. Deliberately neutral: no real branding,
 * and labelled as a simulation on every screen. In production the browser goes to the real provider instead.
 */
export default function MyGovDemo() {
  useDocumentTitle("Dövlət identifikasiyası (simulyasiya)");
  const [params] = useSearchParams();
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [fin, setFin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clientId = params.get("client_id") ?? "";
  const state = params.get("state") ?? "";
  const redirect = params.get("redirect_uri") ?? "/mygov/callback";
  const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/mygov/callback";

  useEffect(() => {
    api<Citizen[]>("/mock-mygov/api/citizens").then(setCitizens).catch(() => {});
  }, []);

  const approve = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ code: string; state: string }>("/mock-mygov/api/authorize", { method: "POST", body: { client_id: clientId, fin: value, state } });
      location.href = `${safeRedirect}?code=${encodeURIComponent(r.code)}&state=${encodeURIComponent(r.state)}`;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#eef1f4", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "min(480px, 100%)" }}>
        <div className="callout callout--warn" style={{ marginBottom: 14 }}>
          <ShieldAlert />
          <div><b>Simulyasiya.</b> Bu ekran dövlət identifikasiya xidmətini əvəz edən demo provayderdir. Real sistemdə burada vətəndaş öz hesabı ilə daxil olur.</div>
        </div>
        <div className="panel" style={{ borderRadius: 14 }}>
          <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ ["--gap" as string]: "12px" }}>
              <span style={{ width: 42, height: 42, borderRadius: 10, background: "#1f3b57", color: "#fff", display: "grid", placeItems: "center" }}><Fingerprint size={22} /></span>
              <div>
                <div style={{ font: "700 17px var(--font-display)" }}>Dövlət identifikasiyası</div>
                <div className="faint" style={{ fontSize: 12.5 }}>OAuth 2.0 · demo provayder</div>
              </div>
            </div>
            <p style={{ marginTop: 16, fontSize: 14.5 }}>
              <b>Aqrar İnvest</b> portalı sizin bu məlumatlarınıza giriş istəyir: FİN, ad və soyad, mobil nömrə.
            </p>
          </div>
          <div style={{ padding: "18px 24px 24px" }}>
            <span className="label">Demo vətəndaş seçin</span>
            <div style={{ display: "grid", gap: 8, margin: "10px 0 18px" }}>
              {citizens.map((c) => (
                <button key={c.fin} className="btn btn--ghost" style={{ justifyContent: "space-between", height: 50 }} disabled={busy} onClick={() => approve(c.fin)}>
                  <span style={{ textAlign: "left" }}>{c.name}<br /><span className="faint" style={{ fontSize: 12, fontWeight: 500 }}>{c.phone}</span></span>
                  <span className="mono faint">{c.fin}</span>
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="fin">və ya FİN daxil edin</label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input id="fin" className="input mono" maxLength={7} value={fin} onChange={(e) => setFin(e.target.value.toUpperCase())} />
                <button className="btn" disabled={busy || fin.length !== 7} onClick={() => approve(fin)}>Razıyam</button>
              </div>
            </div>
            {error && <div className="callout callout--danger">{error}</div>}
            <button className="btn btn--quiet btn--block" style={{ marginTop: 6 }} onClick={() => (location.href = "/giris?mygov=denied")}>İmtina et və portala qayıt</button>
          </div>
        </div>
      </div>
    </div>
  );
}
