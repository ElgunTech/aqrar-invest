// Official open data pipeline.
//
// Downloads:
//   * ANAMA: boundaries of cleared and certified areas in the liberated territories (opendata.az, ODC-BY)
//   * State Statistics Committee (azstat.gov.az open data API, CC0): yields and production by district
// and writes compact files the backend bundles:
//   backend/src/main/resources/opendata/anama_agri.geojson   cleared areas requested by the Ministry of Agriculture
//   backend/src/main/resources/opendata/plots.json            the competition plots, built from real ANAMA polygons
//   backend/src/main/resources/opendata/azstat/<key>.csv      statistics filtered to the Karabakh economic region
//   backend/src/main/resources/opendata/sources.json          provenance: publisher, URL, licence, fetch time
//
// Run:  cd tools/opendata && npm install && node fetch.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import shapefile from "shapefile";
import proj4 from "proj4";
import AdmZip from "adm-zip";

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = path.join(here, ".cache");
const out = path.resolve(here, "../../backend/src/main/resources/opendata");
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(path.join(out, "azstat"), { recursive: true });

const CKAN = "https://admin.opendata.az/api/3/action/package_show?id=";
const ANAMA_DATASET = "isgaldan-azad-olunmus-erazilerinde-temizlenmis-ve-sertifikatlasdirilmis-sahelerinin-serhedleri";

/** key → opendata.az dataset name (each resolves to an azstat table) */
const AZSTAT = {
  wheat_yield: "bugdanin-mehsuldarligi-sent-ha",
  barley_yield: "arpanin-mehsuldarligi-sent-ha",
  maize_yield: "den-ucun-qargidalinin-mehsuldarligi-sent-ha",
  chickpea_yield: "noxudun-nutun-mehsuldarligi-sent-ha",
  lentil_yield: "mercimeyin-mehsuldarligi-sent-ha",
  bean_yield: "lobyanin-mehsuldarligi-sent-ha",
  grain_yield: "denli-ve-denli-paxlali-bitkilerin-mehsuldarligi-sent-ha",
  grain_area: "denli-ve-denli-paxlali-bitkilerin-ekin-sahesi-ha",
  watermelon_prod: "qarpiz-istehsali-ton",
  melon_prod: "yemis-istehsali-ton",
  fruit_prod: "meyve-ve-gilemeyvelilerin-istehsali-cemi-ton",
  potato_prod: "kartof-istehsali-ton",
};

/** Karabakh economic region units as named by azstat. */
const REGION_UNITS = new Set([
  "Azərbaycan Respublikası", "Qarabağ iqtisadi rayonu", "Ağcabədi rayonu", "Ağdam rayonu", "Bərdə rayonu",
  "Füzuli rayonu", "Xocalı rayonu", "Xocavənd rayonu", "Şuşa rayonu", "Tərtər rayonu", "Xankəndi şəhəri",
]);

/** ANAMA district (English) → Azerbaijani district of the Karabakh economic region. */
const DISTRICTS = {
  Aghdam: "Ağdam", Fizuli: "Füzuli", Khojavend: "Xocavənd", Khojaly: "Xocalı",
  Shusha: "Şuşa", Terter: "Tərtər", Aghdara: "Tərtər", "Khankendi city": "Xankəndi",
};

const json = async (url) => (await fetch(url, { headers: { "User-Agent": "AqrarInvest-hackathon/0.1" } })).json();
const download = async (url, file) => {
  const res = await fetch(url, { headers: { "User-Agent": "AqrarInvest-hackathon/0.1" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
};
const sources = [];
const now = new Date().toISOString();

// ---------------------------------------------------------------- statistics
function parseCsv(text) {
  const rows = [];
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

for (const [key, name] of Object.entries(AZSTAT)) {
  const pkg = (await json(CKAN + name)).result;
  const csvRes = pkg.resources.find((r) => r.format === "CSV");
  const text = await (await fetch(csvRes.url)).text();
  const [header, ...rows] = parseCsv(text);
  const unitCol = header.findIndex((h) => /RAYON|VAHID|ERAZI/i.test(h));
  const kept = rows.filter((r) => REGION_UNITS.has(r[unitCol]) && r[4] !== "Null");
  const lines = ["year,unit,value", ...kept.map((r) => `${r[0]},"${r[unitCol]}",${r[4]}`)];
  fs.writeFileSync(path.join(out, "azstat", `${key}.csv`), lines.join("\n") + "\n");
  sources.push({ key, title: pkg.title, publisher: pkg.organization.title, dataset: `https://opendata.az/@dsk/${name}`,
    api: csvRes.url, license: pkg.license_title, rows: kept.length, fetchedAt: now });
  console.log(`azstat ${key}: ${kept.length} rows`);
}

// ---------------------------------------------------------------- ANAMA cleared areas
const anamaPkg = (await json(CKAN + ANAMA_DATASET)).result;
const zipRes = anamaPkg.resources.find((r) => r.format === "ZIP");
const zip = path.join(cache, "anama.zip");
if (!fs.existsSync(zip)) await download(zipRes.url, zip);
const unz = path.join(cache, "anama");
fs.mkdirSync(unz, { recursive: true });
new AdmZip(zip).extractAllTo(unz, true);
const shp = fs.readdirSync(unz).find((f) => f.endsWith(".shp"));
const utm = fs.readFileSync(path.join(unz, shp.replace(/\.shp$/, ".prj")), "utf8");
const toWgs = proj4(utm, "EPSG:4326");
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const ring = (coords) => coords.map(([x, y]) => toWgs.forward([x, y]).map(r5));

const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const isoDate = (s) => {
  const m = /^(\d{1,2})-(\w{3})-(\d{4})$/.exec(s || "");
  return m ? `${m[3]}-${String(months[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

const features = [];
const src = await shapefile.open(path.join(unz, shp), path.join(unz, shp.replace(/\.shp$/, ".dbf")), { encoding: "utf-8" });
for (;;) {
  const { done, value } = await src.read();
  if (done) break;
  const p = value.properties;
  const district = DISTRICTS[p.District];
  if (!district || !(p.Request_fr || "").includes("Kənd Təsərrüfatı")) continue;
  const g = value.geometry;
  const coordinates = g.type === "Polygon" ? g.coordinates.map(ring) : g.coordinates.map((poly) => poly.map(ring));
  features.push({
    type: "Feature",
    properties: {
      district, village: p.Village, ref: p.MF_ID, name: p.MF_Name, start: isoDate(p.Start), end: isoDate(p.End),
      areaHa: Math.round((p.Area_clear || 0) / 100) / 100, org: p.Organisati,
    },
    geometry: { type: g.type, coordinates },
  });
}
fs.writeFileSync(path.join(out, "anama_agri.geojson"), JSON.stringify({ type: "FeatureCollection", features }));
sources.push({ key: "anama", title: anamaPkg.title, publisher: anamaPkg.organization.title,
  dataset: `https://opendata.az/@anama/${ANAMA_DATASET}`, api: zipRes.url, license: anamaPkg.license_title,
  rows: features.length, filter: "Sifarişçi: Kənd Təsərrüfatı Nazirliyi; Qarabağ iqtisadi rayonu", fetchedAt: now });
console.log(`anama: ${features.length} agricultural cleared areas in the Karabakh region`);

// ANAMA writes village names in English transliteration; the plots carry the Azerbaijani spelling.
const VILLAGE_AZ = {
  Papravend: "Papravənd", Marzili: "Mərzili", Ismayilbayli: "İsmayılbəyli", Sofulu: "Sofulu",
  Dordlar: "Dördlər", Garvend: "Qarvənd", Seyidmahmudlu: "Seyidmahmudlu", Fizuli: "Füzuli", Khanoba: "Xanoba",
  Khojavend: "Xocavənd", Aghkand: "Ağkənd", Garabulag: "Qarabulaq", Tazabina: "Təzəbinə",
  "Kichik Galaderesi": "Kiçik Qaladərəsi", Talish: "Talış", Damirli: "Dəmirli", Aghdara: "Ağdərə",
};

// ---------------------------------------------------------------- competition plots from real polygons
// Per district, the largest single-polygon areas with a village name, between 20 and 400 ha.
const QUOTA = { "Ağdam": 5, "Füzuli": 4, "Xocavənd": 3, "Xocalı": 2, "Şuşa": 1, "Tərtər": 3 };
const centroid = (rings) => {
  const pts = rings[0];
  const n = pts.length - 1;
  return [pts.slice(0, n).reduce((s, p) => s + p[1], 0) / n, pts.slice(0, n).reduce((s, p) => s + p[0], 0) / n];
};
const plots = [];
for (const [district, n] of Object.entries(QUOTA)) {
  const pool = features
    .filter((f) => f.properties.district === district && f.geometry.type === "Polygon" && f.properties.village
      && f.properties.areaHa >= (district === "Şuşa" ? 5 : 20) && f.properties.areaHa <= 400)
    .sort((a, b) => b.properties.areaHa - a.properties.areaHa);
  const used = new Set();
  for (const f of pool) {
    if (plots.filter((p) => p.district === district).length >= n) break;
    if (used.has(f.properties.village)) continue; // one plot per village keeps them spread out
    used.add(f.properties.village);
    const [lat, lng] = centroid(f.geometry.coordinates);
    plots.push({ district, village: VILLAGE_AZ[f.properties.village] ?? f.properties.village, villageEn: f.properties.village, ref: f.properties.ref, areaHa: f.properties.areaHa,
      clearedFrom: f.properties.start, clearedAt: f.properties.end, lat: r5(lat), lng: r5(lng), boundary: f.geometry });
  }
}
fs.writeFileSync(path.join(out, "plots.json"), JSON.stringify(plots, null, 1));
fs.writeFileSync(path.join(out, "sources.json"), JSON.stringify(sources, null, 2));
console.log(`plots: ${plots.length}`);
for (const p of plots) console.log(`  ${p.district.padEnd(9)} ${p.village.padEnd(20)} ${String(p.areaHa).padStart(7)} ha  ${p.ref}  cleared ${p.clearedAt}`);
