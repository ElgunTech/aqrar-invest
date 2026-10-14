import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { Brand } from "../components/Layout";
import { Assistant } from "../components/Assistant";
import { api } from "../lib/api";
import { useAuth, isStaff } from "../lib/auth";
import { countdown, money, num } from "../lib/format";
import { useDocumentTitle } from "../lib/hooks";
import type { Competition, PublicStats } from "../lib/types";
import "./landing.css";
import { LANGS, setLang, useT } from "../lib/i18n";

/*
 * Worldflight landing (scroll-craft). One fixed stage, five legs, nothing in document flow but the spacer.
 * Track (viewport-heights): hero 1.5 · demining 1.3 · fields 1.3 · spring 1.6 = 5.7 (+1 landing room)
 */
const LEGS = [
  { w: 1.5, label: "Dağlar" },
  { w: 1.3, label: "Təhlükəsizlik" },
  { w: 1.3, label: "Torpaq" },
  { w: 1.6, label: "Qayıdış" },
];
const STARTS = LEGS.map((_, i) => LEGS.slice(0, i).reduce((s, l) => s + l.w, 0));
const TOTAL = LEGS.reduce((s, l) => s + l.w, 0);
const win = (from: number, to: number, rIn?: number, rOut?: number) =>
  [from / TOTAL, to / TOTAL, rIn, rOut].filter((x) => x !== undefined).map((x) => (x as number).toFixed(3)).join(" ");

const HERO_WIN = win(0, 0.62 * LEGS[0].w, 0, 0.65);
const FINALE_WIN = win(STARTS[3] + 0.4 * LEGS[3].w, TOTAL, 0.55, 0);

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
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [comp, setComp] = useState<Competition | null>(null);

  // Real data only: stats and the nearest open competition.
  useEffect(() => {
    api<PublicStats>("/api/v1/public/stats").then(setStats).catch(() => {});
    api<Competition[]>("/api/v1/public/competitions").then((cs) => setComp(cs.filter((c) => c.open).sort((a, b) => a.deadline.localeCompare(b.deadline))[0] ?? null)).catch(() => {});
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
            <div data-sc-segment data-sc-w={LEGS[3].w} data-sc-waypoint={LEGS[3].label}>
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
            <div className="lf-scrim lf-scrim--finale" data-lf-win={FINALE_WIN} aria-hidden="true" />

            <div className="lf-copy lf-copy--hero" data-sc-copy data-sc-window="hero">
              <p>{t("Minadan təmizlənmiş sahələri tapın, süni intellektlə yoxlayın, investisiya müsabiqəsinə onlayn müraciət edin.")}</p>
              <Link className="lf-btn" to="/xerite">{t("Sahəni tap")} <ArrowRight size={18} /></Link>
            </div>

            <div className="lf-copy lf-copy--lead" data-sc-copy data-sc-window={win(1.65, 2.75)}>
              <span className="lf-kicker">02 · {t("Təhlükəsizlik")}</span>
              <h2>{t("Hər sahə minadan təmizlənib və sertifikatlıdır.")}</h2>
              <p>{t("Portala yalnız ANAMA-nın rəsmi sertifikat verdiyi sahələr çıxarılır. Təmizlənmə tarixi və sahənin dəqiq sərhədi xəritədə hər kəs üçün açıqdır.")}</p>
              {stats && <div className="lf-fact"><b>{stats.clearedPlots} / {stats.plotCount}</b> {t("sahə ANAMA sertifikatlı")}</div>}
            </div>

            <div className="lf-copy lf-copy--trail" data-sc-copy data-sc-window={win(2.95, 4.05)}>
              <span className="lf-kicker">03 · {t("Torpaq")}</span>
              <h2>{t("Torpaq yenidən məhsul verməyə hazırdır.")}</h2>
              <p>{t("Süni intellekt hər sahənin torpağına görə ən uyğun bitkini tövsiyə edir. Ərazi, su, yol, icarə şərtləri və rəsmi məhsuldarlıq statistikası bir kartda.")}</p>
              {stats && <div className="lf-fact"><b>{num(stats.totalAreaHa)} ha</b> {t("{n} sahədə", { n: stats.plotCount })}</div>}
              <div><Link className="lf-link" to="/kataloq">{t("Sahələrə bax")} <ArrowRight size={16} /></Link></div>
            </div>

            <div className="lf-copy lf-finale" data-sc-copy data-sc-window="finale">
              <span className="lf-kicker">04 · {t("Qayıdış")}</span>
              <h2>{t("Böyük Qayıdış torpaqdan başlayır.")}</h2>
              <p>{t("Hər investisiya kəndə qayıdan ailələr üçün iş yeri deməkdir. Qayıdan sakinlərə verilən iş yerləri müsabiqədə əlavə bal qazandırır.")}</p>
              <div className="lf-finale__row">
                <Link className="lf-btn" to="/xerite">{t("Sahəni tap")} <ArrowRight size={18} /></Link>
                <Link className="lf-btn lf-btn--ghost" to="/musabiqeler">{t("Müsabiqələrə bax")}</Link>
              </div>
              <div className="lf-finale__meta">
                {stats && <span>{t("Qayıdan sakinlər üçün iş yeri")}: <b>{num(stats.returneeJobs)}</b></span>}
                {comp && <span>{t("Ən yaxın son tarix")}: <b>{countdown(comp.deadline)}</b></span>}
                {stats && <span>{t("Planlaşdırılan investisiya")}: <b>{money(stats.plannedInvestment)}</b></span>}
                <Link to="/portal">{t("Portalın ana səhifəsi")}</Link>
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
