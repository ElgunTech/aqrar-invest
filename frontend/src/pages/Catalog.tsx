import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Map as MapIcon, Scale, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PlotCard } from "../components/PlotCard";
import { emptyFilters, filtersToQuery, PlotFilters, type Filters } from "../components/PlotFilters";
import { Empty, Loading, useToast } from "../components/ui";
import { qs } from "../lib/api";
import { useApi, useDebounced, useDocumentTitle } from "../lib/hooks";
import type { Plot } from "../lib/types";

export default function Catalog() {
  useDocumentTitle("İnvestisiya imkanları kataloqu");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const debounced = useDebounced(filters);
  const { data: plots, loading } = useApi<Plot[]>("/api/v1/public/plots" + qs(filtersToQuery(debounced)));
  const [selected, setSelected] = useState<number[]>([]);
  const toast = useToast();
  const nav = useNavigate();

  const toggle = (id: number) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 4) {
        toast("Ən çox 4 sahə müqayisə etmək olar", true);
        return s;
      }
      return [...s, id];
    });

  return (
    <>
      <section className="band">
        <div className="wrap">
          <div className="row row--between row--top">
            <div>
              <h1>İnvestisiya imkanları kataloqu</h1>
              <p>Müsabiqəyə çıxarılan sahələr: ölçü, yerləşmə, istifadə şərtləri, minadan təmizlənmə statusu və son müraciət tarixi. 2–4 sahəni seçib yan-yana müqayisə edin.</p>
            </div>
            <Link className="btn btn--ghost" to="/xerite"><MapIcon size={16} /> Xəritə görünüşü</Link>
          </div>
        </div>
      </section>
      <div className="wrap page">
        <div className="panel panel--pad" style={{ paddingBottom: 8, marginBottom: 24 }}>
          <PlotFilters value={filters} onChange={setFilters} layout="bar" showSort />
        </div>
        <div className="row row--between" style={{ marginBottom: 14 }}>
          <span className="muted">{plots ? `${plots.length} sahə tapıldı` : " "}</span>
          {JSON.stringify(filters) !== JSON.stringify(emptyFilters) && (
            <button className="btn btn--sm btn--quiet" onClick={() => setFilters(emptyFilters)}><X size={14} /> Filtrləri sıfırla</button>
          )}
        </div>
        {loading && !plots ? (
          <Loading />
        ) : plots && plots.length ? (
          <div className="grid grid--3">
            {plots.map((p) => (
              <PlotCard key={p.id} plot={p} compare={{ checked: selected.includes(p.id), onToggle: () => toggle(p.id) }} />
            ))}
          </div>
        ) : (
          <div className="panel"><Empty title="Filtrə uyğun sahə tapılmadı">Filtrləri dəyişin və ya sıfırlayın.</Empty></div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="compare-dock" role="region" aria-label="Müqayisə">
          <Scale size={18} />
          <span>{selected.length} sahə seçilib{selected.length < 2 ? " · ən azı 2" : ""}</span>
          <button className="btn btn--sm btn--amber" disabled={selected.length < 2} onClick={() => nav(`/muqayise?ids=${selected.join(",")}`)}>Müqayisə et</button>
          <button className="btn btn--sm btn--outline-light" onClick={() => setSelected([])}>Təmizlə</button>
        </div>
      )}
    </>
  );
}
