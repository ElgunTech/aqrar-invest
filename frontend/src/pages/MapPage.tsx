import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Link, useSearchParams } from "react-router-dom";
import { GeoJSON, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L, { type Marker as LMarker } from "leaflet";
import { ArrowRight, Clock } from "lucide-react";
import { emptyFilters, filtersToQuery, PlotFilters, type Filters } from "../components/PlotFilters";
import { MineTag } from "../components/ui";
import { qs } from "../lib/api";
import { ACTIVITY } from "../lib/domain";
import { money, num, pct } from "../lib/format";
import { useApi, useDebounced, useDocumentTitle } from "../lib/hooks";
import type { Plot } from "../lib/types";

const icons = new Map<string, L.DivIcon>();
function pinIcon(code: string) {
  if (!icons.has(code)) {
    const a = ACTIVITY[code];
    const Icon = a.icon;
    icons.set(code, L.divIcon({
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30],
      html: renderToStaticMarkup(<div className="pin" style={{ background: a.color }}><Icon /></div>),
    }));
  }
  return icons.get(code)!;
}

function FitBounds({ plots }: { plots: Plot[] }) {
  const map = useMap();
  const key = plots.map((p) => p.id).join(",");
  useEffect(() => {
    if (!plots.length) return;
    map.fitBounds(L.latLngBounds(plots.map((p) => [p.latitude, p.longitude])), { padding: [48, 48], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function FlyTo({ target }: { target: Plot | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], 13, { duration: 0.8 });
  }, [target, map]);
  return null;
}

function AnamaLayer() {
  const { data } = useApi<GeoJSON.FeatureCollection>("/api/v1/public/official/anama");
  if (!data) return null;
  return (
    <GeoJSON data={data} style={{ color: "#c2410c", weight: 1, fillColor: "#f59e0b", fillOpacity: 0.18 }}
      onEachFeature={(f, layer) => {
        const p = f.properties as { district: string; village: string; ref: string; areaHa: number; end: string };
        layer.bindPopup(`<b>ANAMA ${p.ref}</b><br>${p.district}, ${p.village ?? ""}<br>${p.areaHa} ha · sertifikat: ${p.end ?? "?"}<br><span style="color:#777">Sifarişçi: Kənd Təsərrüfatı Nazirliyi</span>`);
      }} />
  );
}

function Legend() {
  return (
    <div className="map-legend" style={{ position: "absolute", left: 12, bottom: 24, zIndex: 500 }}>
      <b>Təyinat</b>
      {Object.entries({ CROP_FARMING: "Əkinçilik", LIVESTOCK: "Heyvandarlıq", HORTICULTURE: "Bağçılıq", VITICULTURE: "Üzümçülük", GREENHOUSE: "İstixana", BEEKEEPING: "Arıçılıq" }).map(([k, v]) => (
        <div key={k}><i style={{ background: ACTIVITY[k].color }} />{v}</div>
      ))}
      <div style={{ marginTop: 6, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
        <div><i style={{ border: "2px solid #26775a", background: "transparent", borderRadius: 2 }} />Müsabiqə sahəsinin real sərhədi</div>
        <div><i style={{ border: "1px solid #c2410c", background: "#fde7c4", borderRadius: 2 }} />ANAMA: təmizlənmiş k/t sahələri</div>
      </div>
    </div>
  );
}

export default function MapPage() {
  useDocumentTitle("Aqrar investisiya xəritəsi");
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, activity: params.get("activity") ?? "", district: params.get("district") ?? "" });
  const debounced = useDebounced(filters);
  const { data } = useApi<Plot[]>("/api/v1/public/plots" + qs(filtersToQuery(debounced)));
  const plots = useMemo(() => data ?? [], [data]);
  const [focus, setFocus] = useState<Plot | null>(null);
  const markers = useRef<Record<number, LMarker | null>>({});

  useEffect(() => {
    if (focus) setTimeout(() => markers.current[focus.id]?.openPopup(), 850);
  }, [focus]);

  return (
    <div className="map-shell">
      <aside className="map-shell__side" aria-label="Filtrlər">
        <h2 style={{ fontSize: 20 }}>Aqrar investisiya xəritəsi</h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 18px" }}>Sahələrin sərhədləri ANAMA-nın rəsmi açıq məlumatlarındandır (opendata.az). Narıncı qat: Kənd Təsərrüfatı Nazirliyinin sifarişi ilə minadan təmizlənmiş bütün sahələr.</p>
        <PlotFilters value={filters} onChange={setFilters} />
        <div className="row row--between">
          <b>{plots.length} sahə</b>
          <button className="btn btn--sm btn--quiet" onClick={() => setFilters(emptyFilters)}>Sıfırla</button>
        </div>
        <div className="map-list">
          {plots.map((p) => {
            const a = ACTIVITY[p.activityType.code];
            const Icon = a.icon;
            return (
              <button key={p.id} onClick={() => setFocus(p)} aria-current={focus?.id === p.id}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: a.tint, color: a.color, display: "grid", placeItems: "center", flex: "none" }}><Icon size={17} /></span>
                <span className="grow">
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.title}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{p.district} · {num(p.areaHa, 1)} ha · {money(p.minInvestment)}</div>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="map-shell__map">
        <MapContainer center={[39.85, 46.95]} zoom={9} scrollWheelZoom>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Xəritə">
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Peyk görüntüsü">
              <TileLayer attribution="Esri World Imagery" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay checked name="ANAMA: minadan təmizlənmiş k/t sahələri (rəsmi)">
              <AnamaLayer />
            </LayersControl.Overlay>
          </LayersControl>
          <FitBounds plots={plots} />
          <FlyTo target={focus} />
          {plots.filter((p) => p.boundaryGeoJson).map((p) => (
            <GeoJSON key={"b" + p.id} data={JSON.parse(p.boundaryGeoJson!)}
              style={{ color: "#1b5e20", weight: 2.5, fillColor: ACTIVITY[p.activityType.code].color, fillOpacity: 0.35 }} />
          ))}
          {plots.map((p) => (
            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={pinIcon(p.activityType.code)} title={p.title}
              ref={(m) => { markers.current[p.id] = m; }}>
              <Popup>
                <h4>{p.title}</h4>
                <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>{p.code} · {p.district}, {p.village}</div>
                <div style={{ display: "grid", gap: 4 }}>
                  <div><b>{num(p.areaHa, 1)} ha</b> · {p.activityType.label}</div>
                  <div>Minimum investisiya: <b>{money(p.minInvestment)}</b></div>
                  <div><MineTag label={p.mineClearance} /></div>
                  {p.aiTopCrop && <div className="row" style={{ ["--gap" as string]: "6px" }}>AI: <b>{p.aiTopCrop.name}</b> ({pct(p.aiTopCrop.probability)})</div>}
                  {p.openCompetition
                    ? <div className="row" style={{ ["--gap" as string]: "6px" }}><Clock size={14} /> Müraciətə <b>{p.openCompetition.daysLeft} gün</b> qalıb</div>
                    : <div className="faint">Hazırda müsabiqədə deyil</div>}
                </div>
                <Link to={`/sahe/${p.id}`} className="btn btn--sm" style={{ marginTop: 12, color: "#fff" }}>Ətraflı <ArrowRight size={14} /></Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <Legend />
      </div>
    </div>
  );
}
