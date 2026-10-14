import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Empty } from "../components/ui";
import { useDocumentTitle } from "../lib/hooks";

export default function NotFound() {
  useDocumentTitle("Səhifə tapılmadı");
  return (
    <div className="wrap page">
      <div className="panel">
        <Empty title="Səhifə tapılmadı" icon={<Compass aria-hidden />}>
          <p>Axtardığınız ünvan mövcud deyil və ya köçürülüb.</p>
          <Link className="btn" to="/xerite" style={{ marginTop: 16 }}>Xəritəyə keç</Link>
        </Empty>
      </div>
    </div>
  );
}
