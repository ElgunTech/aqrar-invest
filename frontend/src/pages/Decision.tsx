import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { Loading } from "../components/ui";
import { date, dateTime, money, num } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { Application } from "../lib/types";

/**
 * Official competition decision (protocol extract) for an approved or rejected application.
 * Printable; "Save as PDF" in the print dialog produces the PDF. The QR code opens the public /yoxla check.
 */
export default function Decision({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const { data: a } = useApi<Application>(admin ? `/api/v1/admin/applications/${id}` : `/api/v1/me/applications/${id}`);
  const [qr, setQr] = useState<string | null>(null);
  const verifyUrl = a ? `${location.origin}/yoxla/${a.applicationNumber}` : "";
  useDocumentTitle(a ? `Qərar ${a.applicationNumber}` : "Qərar");

  useEffect(() => {
    if (verifyUrl) QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, color: { dark: "#0b2219", light: "#ffffff" } }).then(setQr);
  }, [verifyUrl]);

  if (!a) return <Loading />;
  const back = admin ? "/admin" : `/kabinet/${a.id}`;
  const approved = a.status.code === "APPROVED";
  const decided = a.status.code === "APPROVED" || a.status.code === "REJECTED";
  const decisionEntry = [...a.history].reverse().find((h) => h.toStatus?.code === a.status.code);
  const decisionDate = decisionEntry?.changedAt ?? a.updatedAt;
  const decisionNo = `Q-${a.applicationNumber.replace(/^[A-Z]+-?/, "")}`;

  if (!decided) {
    return (
      <div className="receipt-page">
        <div className="receipt-actions no-print"><Link className="btn btn--ghost" to={back}><ArrowLeft size={16} /> Geri</Link></div>
        <article className="receipt"><h1>Qərar hələ qəbul edilməyib</h1><p>Müraciətin cari statusu: {a.status.label}.</p></article>
      </div>
    );
  }

  return (
    <div className="receipt-page">
      <div className="receipt-actions no-print">
        <Link className="btn btn--ghost" to={back}><ArrowLeft size={16} /> Müraciətə qayıt</Link>
        <button className="btn" onClick={() => print()}><Printer size={16} /> Çap et / PDF kimi saxla</button>
      </div>
      <article className="receipt decision">
        <div className="flag-strip" />
        <header className="receipt__head">
          <div>
            <div className="receipt__org">Aqrar İnvest · İnvestisiya müsabiqəsi portalı</div>
            <div className="receipt__org">Müsabiqə komissiyası</div>
            <h1>Müsabiqənin nəticəsi haqqında QƏRAR</h1>
          </div>
          {qr && <img src={qr} alt={`Yoxlama QR kodu: ${verifyUrl}`} width={110} height={110} />}
        </header>

        <div className="receipt__number">
          <span>Qərar № {decisionNo} · {date(decisionDate)}</span>
          <b className={approved ? "decision__verdict decision__verdict--ok" : "decision__verdict"}>{approved ? "QALİB ELAN EDİLDİ" : "RƏDD EDİLDİ"}</b>
        </div>

        <p className="decision__lead">
          Müsabiqə komissiyası <b>{a.competitionCode}</b> nömrəli «{a.competitionTitle}» müsabiqəsi çərçivəsində <b>{a.applicationNumber}</b> nömrəli
          müraciəti, təqdim olunmuş sənədləri və qiymətləndirmə nəticələrini nəzərdən keçirərək {approved
            ? <>müraciətçini <b>{a.plotCode}</b> nömrəli sahə üzrə <b>qalib</b> elan etmişdir.</>
            : <>müraciətin <b>təmin edilməməsi</b> barədə qərar qəbul etmişdir.</>}
        </p>

        <table className="receipt__table">
          <tbody>
            <tr><th>Müraciətçi</th><td>{a.applicantName} ({a.applicantType.label})</td></tr>
            <tr><th>FİN / VÖEN</th><td className="mono">{a.taxId}</td></tr>
            <tr><th>Sahə</th><td>{a.plotCode} · {a.plotTitle}, {a.district}</td></tr>
            <tr><th>Fəaliyyət</th><td>{a.activityType.label}{a.plannedCropName ? `, ${a.plannedCropName}` : ""}</td></tr>
            <tr><th>İnvestisiya öhdəliyi</th><td>{money(a.plannedInvestment)}, {a.projectMonths} ay ərzində</td></tr>
            <tr><th>İş yerləri</th><td>{a.jobsCreated}{a.returneeJobs ? `, o cümlədən ${a.returneeJobs} keçmiş məcburi köçkün («Böyük Qayıdış»)` : ""}</td></tr>
            <tr><th>Avtomatik qiymətləndirmə</th><td>{num(a.score.total, 1)} / 100 bal</td></tr>
            <tr><th>Komissiya balı (orta)</th><td>{a.commission.average != null ? `${num(a.commission.average, 1)} / 100 bal, ${a.commission.scores.length} üzv` : "—"}</td></tr>
            {a.ektisReference && <tr><th>EKTİS istinadı</th><td className="mono">{a.ektisReference}</td></tr>}
          </tbody>
        </table>

        {(a.decisionNote || decisionEntry?.comment) && (
          <>
            <h2>Əsaslandırma</h2>
            <p>{a.decisionNote || decisionEntry?.comment}</p>
          </>
        )}

        {approved && (
          <>
            <h2>Qalibin öhdəlikləri</h2>
            <ol className="receipt__docs">
              <li>Qərar tarixindən 30 gün ərzində icarə müqaviləsini imzalamaq.</li>
              <li>Biznes-plana uyğun investisiyanı mərhələlər üzrə həyata keçirmək və portalda GPS ilə təsdiqlənmiş foto-hesabat təqdim etmək.</li>
              <li>Bəyan edilmiş iş yerlərini yaratmaq; öhdəliklərin icrası portalın monitorinq modulu ilə izlənilir.</li>
            </ol>
          </>
        )}

        {a.commission.scores.length > 0 && (
          <>
            <h2>Komissiya üzvləri</h2>
            <table className="receipt__table decision__sign">
              <tbody>
                {a.commission.scores.map((s) => (
                  <tr key={s.evaluator}><th>{s.evaluator}</th><td>{num(s.total, 1)} bal</td><td className="decision__line">imza: elektron təsdiqlənib</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="decision__seal">
          <div><span>Komissiya sədri</span><b>{decisionEntry?.changedBy ?? "—"}</b><i>elektron imza · {dateTime(decisionDate)}</i></div>
          <div className="decision__stamp" aria-hidden>M.Y.</div>
        </div>

        <footer className="receipt__foot">
          <p>Qərar elektron sənəddir. Həqiqiliyini QR kodu skan edərək və ya bu ünvanda yoxlaya bilərsiniz:</p>
          <p className="mono">{verifyUrl}</p>
          <p className="faint">Çap tarixi: {dateTime(new Date().toISOString())}</p>
        </footer>
      </article>
    </div>
  );
}
