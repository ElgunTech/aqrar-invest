import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, X } from "lucide-react";
import { api } from "../lib/api";

interface Reply {
  answer: string;
  links: { label: string; url: string }[];
  sources: string[];
  suggestions: string[];
  engine: string;
}

interface Message {
  from: "user" | "bot";
  text: string;
  reply?: Reply;
}

const START: Message = {
  from: "bot",
  text: "Salam! Sahələr, müsabiqələr, rayonlar üzrə rəsmi statistika və minatəmizləmə barədə soruşa bilərsiniz.",
  reply: {
    answer: "", links: [], sources: [], engine: "built-in",
    suggestions: ["Ağdamda buğdanın məhsuldarlığı nə qədərdir?", "Xocavənddə nə qədər ərazi minadan təmizlənib?", "Hansı müsabiqələr açıqdır?"],
  },
};

/** Floating portal assistant. Answers come from /api/v1/public/assistant and always cite their sources. */
export function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([START]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { from: "user", text: q }]);
    setBusy(true);
    try {
      const reply = await api<Reply>("/api/v1/public/assistant", { method: "POST", body: { message: q } });
      setMessages((m) => [...m, { from: "bot", text: reply.answer, reply }]);
    } catch (e) {
      setMessages((m) => [...m, { from: "bot", text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const last = [...messages].reverse().find((m) => m.from === "bot")?.reply;

  return (
    <>
      {open && (
        <section className="chat" role="dialog" aria-label="Portal köməkçisi">
          <header className="chat__head">
            <div>
              <b>Portal köməkçisi</b>
              <span>Rəsmi mənbələrə əsaslanır</span>
            </div>
            <button className="chat__close" onClick={() => setOpen(false)} aria-label="Bağla"><X size={18} /></button>
          </header>
          <div className="chat__body" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`chat__msg chat__msg--${m.from}`}>
                <div className="chat__bubble">
                  {m.text.split("\n").map((line, j) => <p key={j}>{line}</p>)}
                  {m.reply && m.reply.links.length > 0 && (
                    <div className="chat__links">
                      {m.reply.links.map((l) => <Link key={l.url + l.label} to={l.url} onClick={() => setOpen(false)}>{l.label}</Link>)}
                    </div>
                  )}
                  {m.reply && m.reply.sources.length > 0 && <div className="chat__src">Mənbə: {m.reply.sources.join("; ")}</div>}
                </div>
              </div>
            ))}
            {busy && <div className="chat__msg chat__msg--bot"><div className="chat__bubble chat__typing">Axtarılır…</div></div>}
            <div ref={end} />
          </div>
          {last && last.suggestions.length > 0 && (
            <div className="chat__sugg">
              {last.suggestions.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
            </div>
          )}
          <form className="chat__form" onSubmit={submit}>
            <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Sualınızı yazın…" maxLength={500} aria-label="Sual" />
            <button className="btn" disabled={busy || !input.trim()} aria-label="Göndər"><Send size={16} /></button>
          </form>
        </section>
      )}
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Portal köməkçisi">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && <span>Köməkçi</span>}
      </button>
    </>
  );
}
