import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Callout, Loading, useToast } from "../components/ui";
import type { User } from "../lib/types";

export default function MyGovCallback() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // the code is single-use; StrictMode would otherwise send it twice
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError("myGov cavabında kod yoxdur.");
      return;
    }
    api<{ user: User; created: boolean }>("/api/v1/auth/mygov/callback", { method: "POST", body: { code, state } })
      .then(async (r) => {
        await refresh();
        toast(r.created ? `Hesabınız myGov ilə yaradıldı, ${r.user.fullName}` : `Xoş gəlmisiniz, ${r.user.fullName}`);
        let next: string | null = null;
        try {
          next = sessionStorage.getItem("mygov-next");
          sessionStorage.removeItem("mygov-next");
        } catch {
          /* storage unavailable */
        }
        nav(next && next.startsWith("/") ? next : r.user.role === "INVESTOR" ? "/kabinet" : "/admin", { replace: true });
      })
      .catch((e: Error) => setError(e.message));
  }, [params, refresh, nav, toast]);

  return (
    <div className="wrap page" style={{ maxWidth: 560 }}>
      {error ? (
        <div className="panel panel--pad">
          <Callout tone="danger">{error}</Callout>
          <Link className="btn" to="/giris" style={{ marginTop: 16 }}>Girişə qayıt</Link>
        </div>
      ) : (
        <div className="panel panel--pad" style={{ textAlign: "center" }}>
          <Loading label="Şəxsiyyət yoxlanılır" />
          <p className="muted">Şəxsiyyətiniz yoxlanılır…</p>
        </div>
      )}
    </div>
  );
}
