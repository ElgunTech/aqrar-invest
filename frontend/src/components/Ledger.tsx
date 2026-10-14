import { Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Loading } from "./ui";
import { dateTime } from "../lib/format";
import { useApi } from "../lib/hooks";

export interface LedgerVerification {
  applicationNumber: string;
  chainValid: boolean;
  recordsValid: boolean;
  chainLength: number;
  headHash: string;
  entries: { seq: number; kind: "STATUS" | "SCORE"; summary: string; recordedAt: string; hash: string; prevHash: string }[];
  issues: string[];
}

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/**
 * Integrity of an application's decisions: each status change and commission score is sealed into a SHA-256 hash
 * chain; the panel shows whether the chain is intact and whether the current records still match the sealed copy.
 */
export function LedgerPanel({ number, reloadKey = 0 }: { number: string; reloadKey?: number }) {
  const { data, loading } = useApi<LedgerVerification>(`/api/v1/public/verify/${encodeURIComponent(number)}/ledger?k=${reloadKey}`);
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const ok = data.chainValid && data.recordsValid;
  return (
    <section className={`ledger ${ok ? "ledger--ok" : "ledger--bad"}`}>
      <div className="ledger__head">
        {ok ? <ShieldCheck size={26} /> : <ShieldAlert size={26} />}
        <div>
          <b>{ok ? "Qərarlar möhürləndikdən sonra dəyişdirilməyib" : "Diqqət: qeydlər möhürlənmiş vəziyyətdən fərqlənir"}</b>
          <span>
            {ok
              ? `${data.entries.length} qərar qeydi SHA-256 hash zəncirində yoxlanıldı; jurnalın ${data.chainLength} qeydinin hamısı bütövdür.`
              : data.issues.join(" · ")}
          </span>
        </div>
      </div>
      <ol className="ledger__chain">
        {data.entries.map((e) => (
          <li key={e.seq}>
            <span className="ledger__dot"><Link2 size={12} /></span>
            <div>
              <div>{e.summary}</div>
              <div className="faint" style={{ fontSize: 12 }}>
                #{e.seq} · {dateTime(e.recordedAt)} · <span className="mono" title={e.hash}>{short(e.hash)}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="faint" style={{ fontSize: 12 }}>
        Jurnalın son hash-i: <span className="mono">{short(data.headHash)}</span>. Hər qeydin hash-i əvvəlkinin hash-ini əhatə edir:
        bir qeydi dəyişmək bütün sonrakı zənciri pozur.
      </p>
    </section>
  );
}
