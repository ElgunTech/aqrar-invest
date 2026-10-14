import { Search } from "lucide-react";
import { useMeta } from "../lib/hooks";

export interface Filters {
  q: string;
  activity: string;
  district: string;
  mineClearance: string;
  crop: string;
  minArea: string;
  maxArea: string;
  onlyOpen: boolean;
  sort: string;
}

export const emptyFilters: Filters = { q: "", activity: "", district: "", mineClearance: "", crop: "", minArea: "", maxArea: "", onlyOpen: false, sort: "" };

export function filtersToQuery(f: Filters) {
  return {
    q: f.q.trim(), activity: f.activity, district: f.district, mineClearance: f.mineClearance, crop: f.crop,
    minArea: f.minArea, maxArea: f.maxArea, onlyOpen: f.onlyOpen, sort: f.sort,
  };
}

export function PlotFilters({ value, onChange, layout = "stack", showSort }: {
  value: Filters; onChange: (f: Filters) => void; layout?: "stack" | "bar"; showSort?: boolean;
}) {
  const meta = useMeta();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const bar = layout === "bar";

  return (
    <div style={bar ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0 14px", alignItems: "end" } : undefined}>
      <div className="field" style={bar ? { gridColumn: "span 2" } : undefined}>
        <label htmlFor="f-q">Axtarış</label>
        <div className="input-group">
          <Search />
          <input id="f-q" className="input" type="search" placeholder="Kənd, rayon, sahə kodu…" value={value.q} onChange={(e) => set("q", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="f-act">Fəaliyyət istiqaməti</label>
        <select id="f-act" className="select" value={value.activity} onChange={(e) => set("activity", e.target.value)}>
          <option value="">Hamısı</option>
          {meta?.activityTypes.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-dis">Rayon</label>
        <select id="f-dis" className="select" value={value.district} onChange={(e) => set("district", e.target.value)}>
          <option value="">Hamısı</option>
          {meta?.districts.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-mine">Minadan təmizlənmə</label>
        <select id="f-mine" className="select" value={value.mineClearance} onChange={(e) => set("mineClearance", e.target.value)}>
          <option value="">Hamısı</option>
          {meta?.mineClearance.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
        </select>
      </div>
      {!bar && (
        <div className="field">
          <label htmlFor="f-crop">AI tövsiyə etdiyi bitki</label>
          <select id="f-crop" className="select" value={value.crop} onChange={(e) => set("crop", e.target.value)}>
            <option value="">Hamısı</option>
            {meta?.crops.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
      )}
      {!bar && (
        <div className="field">
          <span className="label">Sahə, hektar</span>
          <div className="form-grid" style={{ gap: 8 }}>
            <input className="input" type="number" min={0} placeholder="min" aria-label="Minimum sahə" value={value.minArea} onChange={(e) => set("minArea", e.target.value)} />
            <input className="input" type="number" min={0} placeholder="maks" aria-label="Maksimum sahə" value={value.maxArea} onChange={(e) => set("maxArea", e.target.value)} />
          </div>
        </div>
      )}
      {showSort && (
        <div className="field">
          <label htmlFor="f-sort">Sıralama</label>
          <select id="f-sort" className="select" value={value.sort} onChange={(e) => set("sort", e.target.value)}>
            <option value="">Koda görə</option>
            <option value="deadline">Son tarix yaxın</option>
            <option value="area_desc">Sahə: böyükdən</option>
            <option value="area_asc">Sahə: kiçikdən</option>
            <option value="investment_asc">Min. investisiya: azdan</option>
          </select>
        </div>
      )}
      <div className="field" style={bar ? { justifyContent: "center" } : undefined}>
        <label className="check">
          <input type="checkbox" checked={value.onlyOpen} onChange={(e) => set("onlyOpen", e.target.checked)} /> Yalnız açıq müsabiqədə olanlar
        </label>
      </div>
    </div>
  );
}
