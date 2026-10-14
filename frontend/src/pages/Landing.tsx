import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { Brand } from "../components/Layout";
import { Assistant } from "../components/Assistant";
import { api } from "../lib/api";
import { useAuth, isStaff } from "../lib/auth";
import { countdown, money, num } from "../lib/format";
import { useDocumentTitle } from "../lib/hooks";
import type { Competition, CropRecommendation, PublicStats, SoilClimate } from "../lib/types";
import "./landing.css";
import { LANGS, setLang, useT } from "../lib/i18n";

/*
 * Worldflight landing (scroll-craft). One fixed stage, five legs, nothing in document flow but the spacer.
 * Track (viewport-heights): hero 1.5 · demining 1.3 · fields 1.3 · PEAK soil 2.4 · spring 1.6 = 8.1 (+1 landing room)
 */
const LEGS = [
  { w: 1.5, label: "Dağlar" },
  { w: 1.3, label: "Təhlükəsizlik" },
  { w: 1.3, label: "Torpaq" },
  { w: 2.4, label: "AI oxuyur" },
  { w: 1.6, label: "Qayıdış" },
];
const STARTS = LEGS.map((_, i) => LEGS.slice(0, i).reduce((s, l) => s + l.w, 0));
const TOTAL = LEGS.reduce((s, l) => s + l.w, 0);
const win = (from: number, to: number, rIn?: number, rOut?: number) =>
  [from / TOTAL, to / TOTAL, rIn, rOut].filter((x) => x !== undefined).map((x) => (x as number).toFixed(3)).join(" ");

const HERO_WIN = win(0, 0.62 * LEGS[0].w, 0, 0.65);
const FINALE_WIN = win(STARTS[4] + 0.4 * LEGS[4].w, TOTAL, 0.55, 0);

/** Same plateau window the engine uses for copy, applied to the scrims it does not drive. */
function windowVis(pr: number, spec: string): number {
  const [from, to, rIn = 0.3, rOut = 0.3] = spec.split(" ").map(Number);
  const w = Math.max(to - from, 0.001);
  const inEnd = from + w * rIn;
  const outStart = to - w * rOut;
  const sm = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  if (pr < from) return 0;
  if (pr < inEnd) return sm((pr - from) / Math.max(inEnd - from, 0.001));
  if (pr <= outStart) return 1;
  return sm(1 - (pr - outStart) / Math.max(to - outStart, 0.001));
}

// The peak: soil profiles of three real districts (same values the plots carry). Scroll morphs between them.
const PROFILES: { place: string; v: SoilClimate }[] = [
  { place: "Ağdam düzənliyi", v: { nitrogen: 118, phosphorus: 46, potassium: 20, temperature: 24.2, humidity: 79, ph: 6.9, rainfall: 79 } },
  { place: "Füzuli dağətəyi", v: { nitrogen: 24, phosphorus: 131, potassium: 199, temperature: 23.6, humidity: 81, ph: 6.0, rainfall: 69 } },
  { place: "Şuşa yaylası", v: { nitrogen: 21, phosphorus: 133, potassium: 200, temperature: 22.4, humidity: 92, ph: 5.9, rainfall: 112 } },
];
const SAMPLES = 41;
const PEAK_FROM = 4.5; // track position where the reader panel is fully legible
const PEAK_TO = 6.05;

/** u ∈ [0,1] → hold A, morph A→B, hold B, morph B→C, hold C */
function profileAt(u: number): { v: SoilClimate; place: string; seg: number; f: number } {
  const stops = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const ease = (x: number) => x * x * (3 - 2 * x);
  const mix = (a: SoilClimate, b: SoilClimate, t: number) =>
    Object.fromEntries(Object.keys(a).map((k) => [k, a[k as keyof SoilClimate] + (b[k as keyof SoilClimate] - a[k as keyof SoilClimate]) * t])) as unknown as SoilClimate;
  if (u < stops[1]) return { v: PROFILES[0].v, place: PROFILES[0].place, seg: 0, f: u / 0.2 };
  if (u < stops[2]) { const t = ease((u - 0.2) / 0.2); return { v: mix(PROFILES[0].v, PROFILES[1].v, t), place: t < 0.5 ? PROFILES[0].place : PROFILES[1].place, seg: 0, f: 1 }; }
  if (u < stops[3]) return { v: PROFILES[1].v, place: PROFILES[1].place, seg: 1, f: (u - 0.4) / 0.2 };
  if (u < stops[4]) { const t = ease((u - 0.6) / 0.2); return { v: mix(PROFILES[1].v, PROFILES[2].v, t), place: t < 0.5 ? PROFILES[1].place : PROFILES[2].place, seg: 1, f: 1 }; }
  return { v: PROFILES[2].v, place: PROFILES[2].place, seg: 2, f: (u - 0.8) / 0.2 };
}

declare global {
  interface Window {
    ScrollCraft?: { mount: (root: Element) => { destroy: () => void }; reduce: boolean };
  }
}

function loadEngine(): Promise<void> {
  if (!document.getElementById("sc-engine-css")) {
    const link = document.createElement("link");
    link.id = "sc-engine-css";
    link.rel = "stylesheet";
    link.href = "/scrollcraft/scrollcraft.css";
    document.head.appendChild(link);
  }
  if (window.ScrollCraft) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/scrollcraft/scrollcraft.js";
    s.onload = () => resolve();
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

function Gauge({ label, value, unit, max, digits = 0 }: { label: string; value: number; unit?: string; max: number; digits?: number }) {
  return (
    <div className="lf-gauge">
      <span>{label}</span>
      <b>{value.toFixed(digits)}{unit && <small style={{ fontSize: 11, fontWeight: 500, marginLeft: 2 }}>{unit}</small>}</b>
      <u style={{ ["--v" as string]: Math.min(1, value / max) }} />
    </div>
  );
}

export default function Landing() {
  useDocumentTitle("");
  const { t, lang } = useT();
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fgRef = useRef<HTMLImageElement>(null);
  const mistRef = useRef<HTMLDivElement>(null);
  const mistFrontRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLElement>(null);
  const [leg, setLeg] = useState(0);
  const [sample, setSample] = useState(0);
  const [preds, setPreds] = useState<CropRecommendation[] | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [comp, setComp] = useState<Competition | null>(null);

  // Real data only: stats, the nearest open competition, and the model's actual answers for the peak.
  useEffect(() => {
    api<PublicStats>("/api/v1/public/stats").then(setStats).catch(() => {});
    api<Competition[]>("/api/v1/public/competitions").then((cs) => setComp(cs.filter((c) => c.open).sort((a, b) => a.deadline.localeCompare(b.deadline))[0] ?? null)).catch(() => {});
    const inputs = Array.from({ length: SAMPLES }, (_, i) => profileAt(i / (SAMPLES - 1)).v);
    api<CropRecommendation[]>("/api/v1/public/ai/recommend/batch", { method: "POST", body: inputs }).then(setPreds).catch(() => {});
  }, []);

  // Mount the engine (untouched) and drive the bespoke layers off the same track.
  useEffect(() => {
    let instance: { destroy: () => void } | null = null;
    let cancelled = false;
    const el = root.current!;
    const onWaypoint = (e: Event) => setLeg((e as CustomEvent<{ index: number }>).detail.index);
    el.addEventListener("sc:waypoint", onWaypoint);
    const relayout = () => dispatchEvent(new Event("resize"));

    loadEngine().then(() => {
      if (cancelled || !window.ScrollCraft) return;
      instance = window.ScrollCraft.mount(el);
      relayout();
      if (document.fonts?.ready) document.fonts.ready.then(relayout);
    });

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let lastSample = -1;
    const frame = () => {
      raf = 0;
      const t = scrollY / innerHeight;
      const hero = Math.min(1, t / LEGS[0].w);
      if (!reduce) {
        if (titleRef.current) {
          titleRef.current.style.transform = `translate(-50%, calc(-50% - ${(hero * 9).toFixed(2)}vh)) scale(${(1 - hero * 0.12).toFixed(4)})`;
          titleRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, hero - 0.3) / 0.32).toFixed(3));
        }
        if (bloomRef.current) {
          bloomRef.current.style.translate = `0 ${(-hero * 16).toFixed(2)}vh`;
          bloomRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, hero - 0.25) / 0.3).toFixed(3));
        }
        if (fgRef.current) fgRef.current.style.transform = `scale(${(1 + hero * 0.11).toFixed(4)})`;
        if (mistRef.current) {
          mistRef.current.style.transform = `translate3d(${(-hero * 7).toFixed(2)}vw, ${(-hero * 3).toFixed(2)}vh, 0)`;
          mistRef.current.style.opacity = String((1 - hero * 0.7).toFixed(3));
        }
        if (mistFrontRef.current) mistFrontRef.current.style.transform = `translate3d(${(hero * 10).toFixed(2)}vw, 0, 0)`;
      } else if (titleRef.current) {
        titleRef.current.style.opacity = hero > 0.55 ? "0" : "1";
        if (bloomRef.current) bloomRef.current.style.opacity = hero > 0.5 ? "0" : "1";
      }
      const pr = t / TOTAL;
      root.current?.querySelectorAll<HTMLElement>("[data-lf-win]").forEach((s) => {
        s.style.opacity = windowVis(pr, s.dataset.lfWin!).toFixed(3);
      });
      const u = Math.min(1, Math.max(0, (t - PEAK_FROM) / (PEAK_TO - PEAK_FROM)));
      const idx = Math.round(u * (SAMPLES - 1));
      if (idx !== lastSample) {
        lastSample = idx;
        setSample(idx);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    addEventListener("load", relayout);
    frame();

    return () => {
      cancelled = true;
      el.removeEventListener("sc:waypoint", onWaypoint);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      removeEventListener("load", relayout);
      if (raf) cancelAnimationFrame(raf);
      instance?.destroy();
      document.getElementById("sc-engine-css")?.remove();
    };
  }, []);

  const peak = useMemo(() => profileAt(sample / (SAMPLES - 1)), [sample]);
  const pred = preds?.[sample];
  const go = (i: number) => scrollTo({ top: (STARTS[i] + (i === 0 ? 0 : LEGS[i].w * 0.45)) * innerHeight, behavior: "smooth" });
  const account = user ? (isStaff(user) ? { to: "/admin", label: t("İnzibati panel") } : { to: "/kabinet", label: t("Kabinetim") }) : { to: "/giris", label: t("Daxil ol") };

  return (
    <div className="landing">
      <div className="lf-top">
        <div className="flag-strip" />
        <div className="lf-govbar">
          <span className="lang-switch" role="group" aria-label={t("Dil")}>
            {LANGS.map((l) => <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</button>)}
          </span>
          <span className="lf-govbar__links"><Link to="/portal">{t("Portal")}</Link><Link to="/yoxla">{t("Qəbzi yoxla")}</Link><a href="/swagger-ui.html">{t("Açıq API")}</a></span>
        </div>
        <nav className="lf-nav" aria-label={t("Əsas menyu")}>
          <Brand />
          <div className="lf-nav__links">
            <Link to="/xerite">{t("Xəritə")}</Link>
            <Link to="/xerite-3d">{t("3D xəritə")}</Link>
            <Link to="/kataloq">{t("Kataloq")}</Link>
            <Link to="/musabiqeler">{t("Müsabiqələr")}</Link>
            <Link to="/ai">{t("AI məsləhətçi")}</Link>
            <Link to="/seffafliq">{t("Şəffaflıq")}</Link>
          </div>
          <div className="lf-nav__right">
            <Link className="btn btn--sm btn--quiet" to={account.to}>{account.label}</Link>
            <Link className="btn btn--sm" to="/xerite"><MapIcon size={15} /> {t("Sahəni tap")}</Link>
          </div>
        </nav>
      </div>

      <Assistant />
      <nav className="lf-rail" aria-label="Hekayənin mərhələləri">
        {LEGS.map((l, i) => (
          <button key={l.label} aria-current={leg === i} onClick={() => go(i)}>{l.label}<i /></button>
        ))}
      </nav>

      <div ref={root}>
        <div data-sc-mode="worldflight" data-sc-seam="0.16" data-sc-lerp="0.12">
          <div data-sc-world>
            {/* 1 · Hero: winter mountains above Shusha. Layered: plate, mist, headline, rock + meadow, front mist. */}
            <div data-sc-segment data-sc-w={LEGS[0].w} data-sc-linger="0.2" data-sc-waypoint={LEGS[0].label}>
              <div className="lf-hero" data-sc-poster>
                <div className="lf-hero__frame">
                  <img className="lf-hero__bg" src="/world/01-mountains.jpg" srcSet="/world/01-mountains-m.jpg 1100w, /world/01-mountains.jpg 2400w" sizes="150vh" alt="" decoding="async" />
                  <div className="lf-hero__mist" ref={mistRef} />
                  <figure className="lf-bloom" ref={bloomRef} aria-hidden="true">
                    <div className="lf-bloom__glow" />
                    <picture>
                      <source type="image/webp" srcSet="/world/xaribulbul-m.webp 480w, /world/xaribulbul.webp 900w" sizes="(max-width: 620px) 34vw, 18vw" />
                      <img src="/world/xaribulbul.png" alt="" width={900} height={671}  decoding="async" />
                    </picture>
                  </figure>
                  <h1 className="lf-hero__title" ref={titleRef}>{t("Qarabağın torpağı yenidən")} <em>{t("əkinə hazırdır")}</em></h1>
                  <img className="lf-hero__fg" ref={fgRef} src="/world/01-mountains.jpg" srcSet="/world/01-mountains-m.jpg 1100w, /world/01-mountains.jpg 2400w" sizes="150vh" alt="" decoding="async" />
                  <div className="lf-hero__mist lf-hero__mist--front" ref={mistFrontRef} />
                </div>
              </div>
            </div>
            {/* 2 · Gravity: ANAMA deminers in Fuzuli */}
            <div data-sc-segment data-sc-w={LEGS[1].w} data-sc-waypoint={LEGS[1].label}>
              <div className="lf-plate" data-sc-poster>
                <img src="/world/02-demining.jpg" srcSet="/world/02-demining-m.jpg 1100w, /world/02-demining.jpg 1800w" sizes="100vw" alt="" decoding="async" style={{ objectPosition: "30% 60%" }} />
              </div>
            </div>
            {/* 3 · Possibility: Fuzuli fields */}
            <div data-sc-segment data-sc-w={LEGS[2].w} data-sc-waypoint={LEGS[2].label}>
              <div className="lf-plate" data-sc-poster>
                <img src="/world/03-fields.jpg" srcSet="/world/03-fields-m.jpg 1100w, /world/03-fields.jpg 2400w" sizes="100vw" alt="" decoding="async" style={{ objectPosition: "60% 60%" }} />
              </div>
            </div>
            {/* 4 · PEAK: young orchard rows on dark soil, Zangilan */}
            <div data-sc-segment data-sc-w={LEGS[3].w} data-sc-linger="0.35" data-sc-waypoint={LEGS[3].label}>
              <div className="lf-plate" data-sc-poster>
                <img src="/world/04-orchard.jpg" srcSet="/world/04-orchard-m.jpg 1100w, /world/04-orchard.jpg 2400w" sizes="100vw" alt="" decoding="async" style={{ objectPosition: "50% 70%" }} />
              </div>
            </div>
            {/* 5 · Resolve: spring on Jidir plain */}
            <div data-sc-segment data-sc-w={LEGS[4].w} data-sc-waypoint={LEGS[4].label}>
              <div className="lf-plate" data-sc-poster>
                <img src="/world/05-spring.jpg" srcSet="/world/05-spring-m.jpg 1100w, /world/05-spring.jpg 2400w" sizes="100vw" alt="" decoding="async" style={{ objectPosition: "55% 55%" }} />
              </div>
            </div>
          </div>

          <div data-sc-world-copy>
            {/* Scrims are siblings of the copy, shaped to where it sits, and faded on the same windows. */}
            <div className="lf-scrim lf-scrim--hero" data-lf-win={HERO_WIN} aria-hidden="true" />
            <div className="lf-scrim lf-scrim--lead" data-lf-win={win(1.65, 2.75)} aria-hidden="true" />
            <div className="lf-scrim lf-scrim--trail" data-lf-win={win(2.95, 4.05)} aria-hidden="true" />
            <div className="lf-scrim lf-scrim--peak" data-lf-win={win(4.15, 6.45, 0.14, 0.16)} aria-hidden="true" />
            <div className="lf-scrim lf-scrim--finale" data-lf-win={FINALE_WIN} aria-hidden="true" />

            <div className="lf-copy lf-copy--hero" data-sc-copy data-sc-window="hero">
              <p>{t("Minadan təmizlənmiş sahələri tapın, süni intellektlə yoxlayın, investisiya müsabiqəsinə onlayn müraciət edin.")}</p>
              <Link className="lf-btn" to="/xerite">{t("Sahəni tap")} <ArrowRight size={18} /></Link>
            </div>

            <div className="lf-copy lf-copy--lead" data-sc-copy data-sc-window={win(1.65, 2.75)}>
              <h2>Əvvəlcə torpaq təhlükəsiz olmalıdır.</h2>
              <p>Portaldakı hər sahə üçün ANAMA-nın minadan təmizlənmə statusu və tarixi açıq göstərilir. Risk gizlədilmir: xəritədə, kataloqda və müraciət formasında görünür.</p>
              {stats && <div className="lf-fact"><b>{stats.clearedPlots} / {stats.plotCount}</b> sahə tam təmizlənib</div>}
            </div>

            <div className="lf-copy lf-copy--trail" data-sc-copy data-sc-window={win(2.95, 4.05)}>
              <h2>Sahələr hazırdır. Şərtlər bir yerdə.</h2>
              <p>Ağdam, Füzuli, Xocalı, Xocavənd, Şuşa, Tərtər və Xankəndi. Hər sahənin kadastr nömrəsi, suyu, yolu, icarə müddəti və minimum investisiyası bir kartda.</p>
              {stats && <div className="lf-fact"><b>{num(stats.totalAreaHa)} ha</b> {stats.plotCount} sahədə</div>}
              <div><Link className="lf-link" to="/kataloq">Kataloqa bax <ArrowRight size={16} /></Link></div>
            </div>

            <div className="lf-peak">
              <div className="lf-peak__lead" data-sc-copy data-sc-window={win(4.15, 6.45, 0.14, 0.16)}>
                <h2>Torpaq danışır. Süni intellekt dinləyir.</h2>
                <p>Scroll etdikcə torpaq nümunəsi Ağdamdan Füzuliyə, oradan Şuşaya keçir. Hər rəqəm portalın içində işləyən modelin real cavabıdır: Kaggle-da öyrədilib, ONNX ilə birbaşa serverdə işləyir.</p>
              </div>
              <div className="lf-reader" aria-live="polite" data-sc-copy data-sc-window={win(4.15, 6.45, 0.14, 0.16)}>
                  <div className="lf-path" aria-hidden>
                    {[0, 1, 2].map((i) => <span key={i}><i style={{ ["--f" as string]: i < peak.seg ? 1 : i === peak.seg ? Math.min(1, peak.f) : 0 }} /></span>)}
                  </div>
                  <div className="lf-reader__head">
                    <span className="lf-reader__place">{peak.place}</span>
                    <span className="lf-reader__live"><i /> Canlı model</span>
                  </div>
                  <div className="lf-gauges">
                    <Gauge label="Azot" value={peak.v.nitrogen} max={140} />
                    <Gauge label="Fosfor" value={peak.v.phosphorus} max={145} />
                    <Gauge label="Kalium" value={peak.v.potassium} max={205} />
                    <Gauge label="pH" value={peak.v.ph} max={9} digits={1} />
                    <Gauge label="Temp." value={peak.v.temperature} unit="°" max={43} digits={1} />
                    <Gauge label="Rütubət" value={peak.v.humidity} unit="%" max={100} />
                    <Gauge label="Yağıntı" value={peak.v.rainfall} unit="mm" max={300} />
                  </div>
                  <div className="lf-crops">
                    {(pred?.recommendations ?? []).filter((c, i) => i === 0 || c.probability >= 0.01).map((c, i) => (
                      <div key={c.code} className={`lf-crop${i === 0 ? " lf-crop--top" : ""}`}>
                        <span className="lf-crop__name">{c.name}</span>
                        <span className="lf-crop__pct">{Math.round(c.probability * 100)}%</span>
                        <span className="lf-crop__bar"><span style={{ transform: `scaleX(${Math.max(0.02, c.probability)})` }} /></span>
                      </div>
                    ))}
                    {!pred && <span style={{ color: "var(--sc-ink-soft)" }}>Model yüklənir…</span>}
                    {pred && pred.recommendations.filter((c) => c.probability < 0.01).length > 0 && (
                      <span style={{ color: "var(--sc-ink-soft)", fontSize: 13 }}>Digər bitkilər: hər biri 1%-dən az ({pred.recommendations.filter((c) => c.probability < 0.01).map((c) => c.name).join(", ")})</span>
                    )}
                  </div>
                  <div className="lf-reader__foot">
                    <span>{pred?.modelLoaded ? `${pred.modelName} · test dəqiqliyi ${Math.round((pred.testAccuracy ?? 0) * 1000) / 10}%` : "Model"}</span>
                    <Link to="/ai" style={{ color: "var(--sc-accent)", fontWeight: 600 }}>Özün yoxla</Link>
                  </div>
              </div>
            </div>

            <div className="lf-copy lf-finale" data-sc-copy data-sc-window="finale">
              <h2>Torpaq gözləyir. Müsabiqə açıqdır.</h2>
              <p>Sahəni seçin, AI ilə yoxlayın və müraciəti onlayn göndərin. Statusu hər addımda görəcəksiniz.</p>
              <div className="lf-finale__row">
                <Link className="lf-btn" to="/xerite">Sahəni tap <ArrowRight size={18} /></Link>
                <Link className="lf-btn lf-btn--ghost" to="/musabiqeler">Müsabiqələrə bax</Link>
              </div>
              <div className="lf-finale__meta">
                {comp && <span>Ən yaxın son tarix: <b>{countdown(comp.deadline)}</b></span>}
                {stats && <span>Planlaşdırılan investisiya: <b>{money(stats.plannedInvestment)}</b></span>}
                <Link to="/portal">Portalın ana səhifəsi</Link>
                  <Link to="/haqqinda">Foto: Wikimedia Commons</Link>
              </div>
            </div>
          </div>
          <div data-sc-spacer aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
