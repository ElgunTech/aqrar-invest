import { useT, LANGS, setLang } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, BookOpen, LogOut, Menu, Sprout } from "lucide-react";
import { useAuth, isStaff } from "../lib/auth";
import { api } from "../lib/api";
import type { Notification } from "../lib/types";
import { Assistant } from "./Assistant";
import { dateTime, initials } from "../lib/format";

const NAV = [
  { to: "/xerite", label: "Xəritə" },
  { to: "/xerite-3d", label: "3D xəritə" },
  { to: "/kataloq", label: "Kataloq" },
  { to: "/musabiqeler", label: "Müsabiqələr" },
  { to: "/ai", label: "Məsləhətçi" },
  { to: "/seffafliq", label: "Şəffaflıq" },
];

export function Brand({ light }: { light?: boolean }) {
  const { t } = useT();
  return (
    <Link to="/" className="brand" style={light ? { color: "#fff" } : undefined}>
      <span className="brand__mark"><Sprout size={22} aria-hidden /></span>
      <span>
        <span className="brand__name">Aqrar İnvest</span>
        <span className="brand__sub" style={light ? { color: "rgb(255 255 255 / .7)" } : undefined}>{t("İnvestisiya müsabiqəsi portalı")}</span>
      </span>
    </Link>
  );
}

function Notifications() {
  const { t } = useT();
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const list = await api<Notification[]>("/api/v1/me/notifications");
      setItems(list);
      if (list.some((n) => !n.read)) {
        await api("/api/v1/me/notifications/read-all", { method: "POST" });
        refresh();
      }
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="icon-btn" onClick={toggle} aria-label={t("Bildirişlər")} aria-expanded={open}>
        <Bell size={18} />
        {!!user?.unreadNotifications && <span className="count">{user.unreadNotifications}</span>}
      </button>
      {open && (
        <div className="popover rise">
          <div className="popover__head">{t("Bildirişlər")}</div>
          {!items && <div className="notif">{t("Yüklənir…")}</div>}
          {items?.length === 0 && <div className="notif muted">{t("Bildiriş yoxdur")}</div>}
          {items?.map((n) => (
            <Link key={n.id} to={n.link || "#"} className={`notif${n.read ? "" : " notif--unread"}`} onClick={() => setOpen(false)}>
              <b>{n.title}</b>
              <span className="muted">{n.message}</span>
              <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>{dateTime(n.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t, lang } = useT();
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    setMenu(false);
  }, [loc.pathname]);

  return (
    <>
      <div className="gov-bar">
        <div className="wrap">
          <span className="lang">
            <span className="lang-switch" role="group" aria-label={t("Dil")}>
              {LANGS.map((l) => (
                <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</button>
              ))}
            </span>
            <span className="hide-sm">{t("Prototip: EKTİS-ə inteqrasiya üçün hazırlanıb")}</span>
          </span>
          <span className="row" style={{ ["--gap" as string]: "18px" }}>
            <Link to="/kataloq">{t("Axtarış")}</Link>
            <Link to="/yoxla" className="hide-sm">{t("Qəbzi yoxla")}</Link>
            <a href="/swagger-ui.html" className="hide-sm"><BookOpen size={12} style={{ verticalAlign: -1 }} /> {t("Açıq API")}</a>
          </span>
        </div>
      </div>
      <header className="header">
        <div className="wrap">
          <Brand />
          <nav className={`nav${menu ? " open" : ""}`} aria-label={t("Əsas menyu")}>
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <div className="header__right">
            {user ? (
              <>
                <Notifications />
                <Link className="btn btn--sm" to={isStaff(user) ? "/admin" : "/kabinet"}>
                  {isStaff(user) ? t("İnzibati panel") : t("Kabinetim")}
                </Link>
                <div className="user-chip">
                  <span className="avatar">{initials(user.fullName)}</span>
                  <span className="user-chip__text">
                    <div className="user-chip__name">{user.fullName}</div>
                    <div className="user-chip__role">{user.roleLabel}</div>
                  </span>
                </div>
                <button className="icon-btn" aria-label={t("Çıxış")} title={t("Çıxış")} onClick={async () => { await logout(); nav("/"); }}>
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn--sm btn--quiet" to="/giris?tab=register">{t("Qeydiyyat")}</Link>
                <Link className="btn btn--sm" to="/giris">{t("Daxil ol")}</Link>
              </>
            )}
            <button className="icon-btn menu-toggle" aria-label={t("Menyu")} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const { t } = useT();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <Brand light />
            <p style={{ marginTop: 16, maxWidth: 380 }}>
              {t("İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı torpaqlarına investisiya müsabiqəsinin rəqəmsal platforması. Prototip, hakaton layihəsi.")}
            </p>
          </div>
          <div>
            <h4>{t("İnvestorlar üçün")}</h4>
            <ul>
              <li><Link to="/xerite">{t("Aqrar investisiya xəritəsi")}</Link></li>
              <li><Link to="/kataloq">{t("İmkanlar kataloqu")}</Link></li>
              <li><Link to="/ai">{t("AI məsləhətçi")}</Link></li>
              <li><Link to="/musabiqeler">{t("Müsabiqələr")}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t("Şəffaflıq")}</h4>
            <ul>
              <li><Link to="/seffafliq">{t("Açıq statistika")}</Link></li>
              <li><Link to="/yoxla">{t("Qəbzi yoxla")}</Link></li>
              <li><a href="/swagger-ui.html">{t("API sənədləri")}</a></li>
              <li><Link to="/haqqinda">{t("Məlumat mənbələri")}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t("Platforma")}</h4>
            <ul>
              <li><Link to="/giris">{t("Daxil ol / Qeydiyyat")}</Link></li>
              <li><Link to="/kabinet">{t("Şəxsi kabinet")}</Link></li>
              <li><Link to="/admin">{t("İnzibati panel")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer__base">
          <span>© {new Date().getFullYear()} {t("Aqrar İnvest prototipi. Məlumatlar nümayiş məqsədlidir.")}</span>
          <span>{t("Fotolar: Wikimedia Commons (CC BY / CC BY-SA)")}</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const { t } = useT();
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <>
      <a href="#main" className="skip-link">{t("Əsas məzmuna keç")}</a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <Assistant />
    </>
  );
}
