import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { Loading } from "../components/ui";
import { dateTime, fileSize, money } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { Application } from "../lib/types";

/** Official, printable application receipt. "Save as PDF" from the print dialog produces the PDF. */
export default function Receipt() {
  const { id } = useParams();
  const { data: a } = useApi<Application>(`/api/v1/me/applications/${id}`);
  const [qr, setQr] = useState<string | null>(null);
  const verifyUrl = a ? `${location.origin}/yoxla/${a.applicationNumber}` : "";
  useDocumentTitle(a ? `Qəbz ${a.applicationNumber}` : "Qəbz");

  useEffect(() => {
    if (verifyUrl) QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, color: { dark: "#0b2219", light: "#ffffff" } }).then(setQr);
  }, [verifyUrl]);

  if (!a) return <Loading />;
  const submitted = a.history.find((h) => h.toStatus?.code === "SUBMITTED")?.changedAt ?? a.createdAt;

  return (
    <div className="receipt-page">
      <div className="receipt-actions no-print">
        <Link className="btn btn--ghost" to={`/kabinet/${a.id}`}><ArrowLeft size={16} /> Müraciətə qayıt</Link>
        <button className="btn" onClick={() => print()}><Printer size={16} /> Çap et / PDF kimi saxla</button>
      </div>
      <article className="receipt">
        <div className="flag-strip" />
        <header className="receipt__head">
          <div>
            <div className="receipt__org">Aqrar İnvest · İnvestisiya müsabiqəsi portalı</div>
            <h1>Elektron müraciət qəbzi</h1>
          </div>
          {qr && <img src={qr} alt={`Yoxlama QR kodu: ${verifyUrl}`} width={110} height={110} />}
        </header>

        <div className="receipt__number">
          <span>Qeydiyyat nömrəsi</span>
          <b className="mono">{a.applicationNumber}</b>
        </div>

        <table className="receipt__table">
          <tbody>
            <tr><th>Qəbul tarixi</th><td>{dateTime(submitted)}</td></tr>
            <tr><th>Müraciətçi</th><td>{a.applicantName} ({a.applicantType.label})</td></tr>
            <tr><th>FİN / VÖEN</th><td className="mono">{a.taxId}</td></tr>
            <tr><th>Müsabiqə</th><td>{a.competitionCode} · {a.competitionTitle}</td></tr>
            <tr><th>Sahə</th><td>{a.plotCode} · {a.plotTitle}, {a.district}</td></tr>
            <tr><th>Fəaliyyət</th><td>{a.activityType.label}{a.plannedCropName ? `, ${a.plannedCropName}` : ""}</td></tr>
            <tr><th>Planlaşdırılan investisiya</th><td>{money(a.plannedInvestment)} (öz vəsaiti {a.ownFundsPercent}%)</td></tr>
            <tr><th>Yeni iş yerləri</th><td>{a.jobsCreated}</td></tr>
            <tr><th>EKTİS istinadı</th><td className="mono">{a.ektisReference ?? "göndərilir"}</td></tr>
            <tr><th>Cari status</th><td>{a.status.label}</td></tr>
          </tbody>
        </table>

        <h2>Təqdim edilmiş sənədlər</h2>
        <ol className="receipt__docs">
          {a.documents.map((d) => <li key={d.id}>{d.type.label}: {d.originalName} ({fileSize(d.sizeBytes)})</li>)}
        </ol>

        <footer className="receipt__foot">
          <p>Bu qəbz müraciətin elektron qaydada qəbul edildiyini təsdiq edir. Həqiqiliyini QR kodu skan edərək və ya bu ünvanda yoxlaya bilərsiniz:</p>
          <p className="mono">{verifyUrl}</p>
          <p className="faint">Çap tarixi: {dateTime(new Date().toISOString())}</p>
        </footer>
      </article>
    </div>
  );
}
