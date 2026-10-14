import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, SearchX, ShieldCheck, ShieldAlert, ShieldX, X } from "lucide-react";
import type { Label } from "../lib/types";
import { TONE } from "../lib/domain";

export function Tag({ label, tone, children }: { label?: Label | null; tone?: string; children?: ReactNode }) {
  if (!label && !children) return null;
  const t = tone ?? (label ? TONE[label.code] : undefined) ?? "muted";
  return <span className={`tag tag--${t}`}>{children ?? label?.label}</span>;
}

export function MineTag({ label }: { label: Label }) {
  const Icon = label.code === "CLEARED" ? ShieldCheck : label.code === "IN_PROGRESS" ? ShieldAlert : ShieldX;
  return (
    <span className={`tag tag--${TONE[label.code]}`} title="ANAMA məlumatı">
      <Icon aria-hidden /> {label.label}
    </span>
  );
}

export function Loading({ label = "Yüklənir" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <SearchX aria-hidden />}
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn" | "ok" | "danger"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <div className={`callout callout--${tone}`}>
      <Icon aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Meter({ value, gold }: { value: number; gold?: boolean }) {
  return (
    <div className={`meter${gold ? " meter--gold" : ""}`} role="presentation">
      <span style={{ width: `${Math.max(1.5, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function ScoreRing({ value, caption = "bal" }: { value: number; caption?: string }) {
  return (
    <div className="score-ring" style={{ ["--v" as string]: value }} aria-label={`${value} / 100`}>
      <div>
        <div>
          <b>{value}</b>
          <br />
          <small>{caption}</small>
        </div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer__head">
          <div className="grow">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Bağla">
            <X size={18} />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
      </aside>
    </>
  );
}

// ------------------------------------------------------------------ toasts

interface ToastItem {
  id: number;
  text: string;
  error?: boolean;
}

const ToastContext = createContext<(text: string, error?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, error }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), error ? 6000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.error ? " toast--error" : ""}`}>
            {t.error ? <AlertCircle /> : <CheckCircle2 />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
