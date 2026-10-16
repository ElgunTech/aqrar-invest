import { useT } from "../lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

// maplibre 6 loads its worker from a separate file; let Vite emit it and tell the library where it is
maplibregl.setWorkerUrl(workerUrl);
import { ArrowRight, Pause, Play, RotateCw, X } from "lucide-react";
import { MineTag } from "../components/ui";
import { ACTIVITY } from "../lib/domain";
import { date, money, num, fit } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import type { Plot } from "../lib/types";

/**
 * 3D investment map: real terrain (open AWS Terrain Tiles), satellite imagery, the official ANAMA layer and the
 * competition plots extruded above the ground. Selecting a plot flies the camera there and slowly orbits it.
 */
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster", tileSize: 256, maxzoom: 18,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Esri World Imagery",
    },
    dem: {
      type: "raster-dem", encoding: "terrarium", tileSize: 256, maxzoom: 14,
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      attribution: "Terrain Tiles (AWS Open Data)",
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
  terrain: { source: "dem", exaggeration: 1.6 },
  sky: { "sky-color": "#a9c8e8", "horizon-color": "#e8eef2", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-color": "#dfe7ec" },
};

function centroid(p: Plot): [number, number] {
  return [p.longitude, p.latitude];
}

export default function Map3D() {
  const { t } = useT();
  useDocumentTitle(t("3D xəritə"));
  const { data } = useApi<Plot[]>("/api/v1/public/plots");
  const plots = useMemo(() => (data ?? []).filter((p) => p.boundaryGeoJson), [data]);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const orbit = useRef<number | null>(null);
  const layersAdded = useRef(false);
  const [selected, setSelected] = useState<Plot | null>(null);
  const [orbiting, setOrbiting] = useState(true);
  const [params] = useSearchParams();
  const initial = Number(params.get("sahe")) || null;

  // the pending "start orbiting when this flight ends" handler, and the selected plot for map click handlers
  const flightEnd = useRef<(() => void) | null>(null);
  const selectedRef = useRef<Plot | null>(null);
  const cancelFlightEnd = () => {
    if (flightEnd.current) map.current?.off("moveend", flightEnd.current);
    flightEnd.current = null;
  };

  const stopOrbit = () => {
    if (orbit.current) cancelAnimationFrame(orbit.current);
    orbit.current = null;
  };
  const startOrbit = () => {
    stopOrbit();
    const step = () => {
      const m = map.current;
      if (!m) return;
      m.setBearing((m.getBearing() + 0.08) % 360);
      orbit.current = requestAnimationFrame(step);
    };
    orbit.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current, style: STYLE, center: [46.95, 39.85], zoom: 8.6, pitch: 55, bearing: -15, maxPitch: 80,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true }, // lets the 3D view be printed or captured
      // on touch screens one finger scrolls the page and two fingers move the map
      cooperativeGestures: window.matchMedia("(pointer: coarse)").matches,
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.TerrainControl({ source: "dem", exaggeration: 1.6 }), "top-right");
    // user interaction pauses the camera tour
    ["mousedown", "touchstart", "wheel"].forEach((ev) => m.on(ev as "mousedown", () => { cancelFlightEnd(); stopOrbit(); setOrbiting(false); }));
    map.current = m;
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      stopOrbit();
      m.remove();
      map.current = null;
      layersAdded.current = false;
    };
  }, []);

  // data layers once both the style and the plots are ready
  useEffect(() => {
    const m = map.current;
    if (!m || plots.length === 0) return;
    const add = async () => {
      if (layersAdded.current) return;
      layersAdded.current = true;
      const anama = await (await fetch("/api/v1/public/official/anama")).json();
      // the style may still be loading (map just created) or long loaded (slow API): try now, else on the next style event
      const apply = () => {
        if (map.current !== m || m.getSource("plots")) return;
        try {
          m.addSource("anama", { type: "geojson", data: anama });
        } catch {
          m.once("styledata", apply);
          return;
        }
        m.addLayer({ id: "anama-fill", type: "fill", source: "anama", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.28 } });
        m.addLayer({ id: "anama-line", type: "line", source: "anama", paint: { "line-color": "#c2410c", "line-width": 0.8 } });

        m.addSource("plots", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: plots.map((p) => ({
              type: "Feature", id: p.id,
              properties: { id: p.id, title: p.title, color: ACTIVITY[p.activityType.code].color },
              geometry: JSON.parse(p.boundaryGeoJson!),
            })),
          },
        });
        m.addLayer({
          id: "plots-3d", type: "fill-extrusion", source: "plots",
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["case", ["boolean", ["feature-state", "selected"], false], 140, 60],
            "fill-extrusion-opacity": 0.85,
          },
        });
        m.addLayer({ id: "plots-outline", type: "line", source: "plots", paint: { "line-color": "#ffffff", "line-width": 2 } });

        m.on("click", "plots-3d", (e) => {
          const id = e.features?.[0]?.properties?.id;
          const p = plots.find((x) => x.id === Number(id));
          if (p) select(p);
        });
        m.on("mouseenter", "plots-3d", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "plots-3d", () => (m.getCanvas().style.cursor = ""));
        const first = initial ? plots.find((x) => x.id === initial) : undefined;
        if (first) { m.setFeatureState({ source: "plots", id: first.id }, { selected: true }); selectedRef.current = first; }
        else startOrbit();
      };
      apply();
    };
    add();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots]);

  // deep link from the 2D map or plot page: /xerite-3d?sahe=<id>
  useEffect(() => {
    const first = initial ? plots.find((x) => x.id === initial) : undefined;
    if (first && map.current) select(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots, initial]);

  const select = (p: Plot) => {
    const m = map.current;
    if (!m) return;
    const previous = selectedRef.current;
    if (m.getSource("plots")) {
      if (previous && previous.id !== p.id) m.setFeatureState({ source: "plots", id: previous.id }, { selected: false });
      m.setFeatureState({ source: "plots", id: p.id }, { selected: true });
    }
    selectedRef.current = p;
    setSelected(p);
    // a new choice replaces the flight in progress: its end must not start the orbit, which would stop this flight
    cancelFlightEnd();
    stopOrbit();
    setOrbiting(false);
    // phones: the list is under the map, so bring the map back into view
    if (window.matchMedia("(max-width: 900px)").matches) container.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    m.flyTo({ center: centroid(p), zoom: 13.6, pitch: 68, bearing: m.getBearing() + 40, duration: 3200, essential: true });
    // registered after flyTo, so the interrupted previous flight's moveend is not taken for this one's end
    const done = () => {
      flightEnd.current = null;
      startOrbit();
      setOrbiting(true);
    };
    flightEnd.current = done;
    m.once("moveend", done);
  };

  const overview = () => {
    const m = map.current;
    if (!m) return;
    cancelFlightEnd();
    stopOrbit();
    setOrbiting(false);
    if (selectedRef.current) m.setFeatureState({ source: "plots", id: selectedRef.current.id }, { selected: false });
    selectedRef.current = null;
    setSelected(null);
    m.flyTo({ center: [46.95, 39.85], zoom: 8.6, pitch: 55, bearing: -15, duration: 2500 });
  };

  const toggleOrbit = () => {
    if (orbiting) { stopOrbit(); setOrbiting(false); } else { startOrbit(); setOrbiting(true); }
  };

  return (
    <div className="map3d">
      <aside className="map3d__list">
        <h2 style={{ fontSize: 18 }}>{t("3D investisiya xəritəsi")}</h2>
        <p className="faint" style={{ fontSize: 12.5, margin: "4px 0 12px" }}>{t("Relyef, peyk görüntüsü və ANAMA-nın rəsmi sərhədləri. Sahəni seçin, kamera ona uçacaq.")}</p>
        {plots.map((p) => {
          const a = ACTIVITY[p.activityType.code];
          const Icon = a.icon;
          return (
            <button key={p.id} onClick={() => select(p)} aria-current={selected?.id === p.id}>
              <span className="map3d__ico" style={{ background: a.tint, color: a.color }}><Icon size={16} /></span>
              <span className="grow">
                <b>{p.title}</b>
                <span>{p.district} · {num(p.areaHa, 1)} ha</span>
              </span>
            </button>
          );
        })}
      </aside>
      <div className="map3d__main">
      <div className="map3d__stage">
        <div ref={container} className="map3d__canvas" />
        <div className="map3d__tools">
          <button className="btn btn--sm btn--light" onClick={toggleOrbit}>{orbiting ? <><Pause size={14} /> {t("Fırlanmanı dayandır")}</> : <><Play size={14} /> {t("Fırlat")}</>}</button>
          <button className="btn btn--sm btn--light" onClick={overview}><RotateCw size={14} /> {t("Ümumi görünüş")}</button>
          <Link className="btn btn--sm btn--light" to="/xerite">{t("2D xəritə")}</Link>
        </div>
      </div>
        {selected && (
          <div className="map3d__card rise">
            <button className="map3d__close" onClick={overview} aria-label={t("Bağla")}><X size={16} /></button>
            <div className="faint mono map3d__meta" style={{ fontSize: 12 }}>{selected.code} · ANAMA {selected.anamaRef}</div>
            <h3 style={{ margin: "4px 0 8px", fontSize: 18 }}>{selected.title}</h3>
            <div className="row" style={{ marginBottom: 10 }}><MineTag label={selected.mineClearance} /><span className="faint" style={{ fontSize: 12.5 }}>{date(selected.mineClearanceDate)}</span></div>
            <dl className="kv" style={{ gridTemplateColumns: "1fr auto", fontSize: 13.5, gap: "4px 12px" }}>
              <dt>{t("Rayon, kənd")}</dt><dd>{selected.district}, {selected.village}</dd>
              <dt>{t("Ərazi")}</dt><dd>{num(selected.areaHa, 1)} ha</dd>
              <dt>{t("Təyinat")}</dt><dd>{t(selected.activityType.label)}</dd>
              <dt>{t("Min. investisiya")}</dt><dd>{money(selected.minInvestment)}</dd>
              {selected.aiTopCrop && <><dt>{t("AI tövsiyəsi")}</dt><dd>{t(selected.aiTopCrop.name)} ({t(fit(selected.aiTopCrop.probability))})</dd></>}
              {selected.openCompetition && <><dt>{t("Son müraciət:").replace(":", "")}</dt><dd>{date(selected.openCompetition.deadline)}</dd></>}
            </dl>
            <Link className="btn btn--block" style={{ marginTop: 14 }} to={`/sahe/${selected.id}`}>{t("Ətraflı")} <ArrowRight size={16} /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
