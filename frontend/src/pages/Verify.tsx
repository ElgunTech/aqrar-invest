import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { Callout, Loading, Tag } from "../components/ui";
import { LedgerPanel } from "../components/Ledger";
import { dateTime } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { Label } from "../lib/types";

interface Verification {
  applicationNumber: string;
  applicant: string;
  competition: string;
  plot: string;
  submittedAt: string;
  status: Label;
  ektisReference: string | null;
}

export default function Verify() {
  const { number } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState(number ?? "");
  const { data, error, loading } = useApi<Verification>(number ? `/api/v1/public/verify/${encodeURIComponent(number)}` : null);
  useDocumentTitle("Qəbzin yoxlanması");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) nav(`/yoxla/${input.trim().toUpperCase()}`);
  };

  return (
    <>
      <section className="band">
        <div className="wrap">
          <h1>Qəbzin həqiqiliyinin yoxlanması</h1>
          <p>Müraciət nömrəsini daxil edin və ya qəbzdəki QR kodu skan edin. Şəxsi məlumatlar göstərilmir.</p>
        </div>
      </section>
      <div className="wrap page" style={{ maxWidth: 760 }}>
        <form className="row" onSubmit={submit} style={{ flexWrap: "nowrap", marginBottom: 24 }}>
          <input className="input mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="QIM-2026-000001" aria-label="Müraciət nömrəsi" />
          <button className="btn">Yoxla</button>
        </form>
        {loading && <Loading />}
        {error && number && <Callout tone="danger">Bu nömrə ilə müraciət tapılmadı. Qəbz saxta ola bilər.</Callout>}
        {data && (
          <div className="panel panel--pad">
            <div className="row" style={{ ["--gap" as string]: "10px", marginBottom: 16 }}>
              <BadgeCheck size={26} color="#26775a" />
              <div>
                <b style={{ font: "700 18px var(--font-display)" }}>Qəbz həqiqidir</b>
                <div className="muted" style={{ fontSize: 13.5 }}>Müraciət portalın reyestrində qeydiyyatdadır.</div>
              </div>
            </div>
            <dl className="kv">
              <dt>Nömrə</dt><dd className="mono">{data.applicationNumber}</dd>
              <dt>Müraciətçi</dt><dd>{data.applicant}</dd>
              <dt>Müsabiqə</dt><dd>{data.competition}</dd>
              <dt>Sahə</dt><dd>{data.plot}</dd>
              <dt>Qəbul tarixi</dt><dd>{dateTime(data.submittedAt)}</dd>
              <dt>Status</dt><dd><Tag label={data.status} /></dd>
              <dt>EKTİS istinadı</dt><dd className="mono">{data.ektisReference ?? "göndərilir"}</dd>
            </dl>
          </div>
        )}
        {data && <div style={{ marginTop: 18 }}><LedgerPanel number={data.applicationNumber} /></div>}
      </div>
    </>
  );
}
