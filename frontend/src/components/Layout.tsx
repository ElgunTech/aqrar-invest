import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, BookOpen, LogOut, Menu, Sprout } from "lucide-react";
import { useAuth, isStaff } from "../lib/auth";
import { api } from "../lib/api";
import type { Notification } from "../lib/types";
import { dateTime, initials } from "../lib/format";

const NAV = [
  { to: "/xerite", label: "Xəritə" },
  { to: "/kataloq", label: "Kataloq" },
  { to: "/musabiqeler", label: "Müsabiqələr" },
  { to: "/ai", label: "AI məsləhətçi" },
  { to: "/seffafliq", label: "Şəffaflıq" },
];

export function Brand({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="brand" style={light ? { color: "#fff" } : undefined}>
      <span className="brand__mark"><Sprout size={22} aria-hidden /></span>
      <span>
        <span className="brand__name">Aqrar İnvest</span>
        <span className="brand__sub" style={light ? { color: "rgb(255 255 255 / .65)" } : undefined}>Qarabağ investisiya müsabiqəsi portalı</span>
      </span>
    </Link>
  );
}

function Notifications() {
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
      <button className="icon-btn" onClick={toggle} aria-label="Bildirişlər" aria-expanded={open}>
        <Bell size={18} />
        {!!user?.unreadNotifications && <span className="count">{user.unreadNotifications}</span>}
      </button>
      {open && (
        <div className="popover rise">
          <div className="popover__head">Bildirişlər</div>
          {!items && <div className="notif">Yüklənir…</div>}
          {items?.length === 0 && <div className="notif muted">Bildiriş yoxdur</div>}
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
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    setMenu(false);
  }, [loc.pathname]);

  return (
    <>
      <div className="flag-strip" />
      <div className="gov-bar">
        <div className="wrap">
          <span>Prototip · EKTİS-ə inteqrasiya üçün hazırlanmış investisiya müsabiqəsi portalı</span>
          <span className="hide-sm row" style={{ ["--gap" as string]: "16px" }}>
            <a href="/swagger-ui.html"><BookOpen size={12} style={{ verticalAlign: -1 }} /> Açıq API</a>
            <span>REST API · OpenAPI 3</span>
          </span>
        </div>
      </div>
      <header className="header">
        <div className="wrap">
          <Brand />
          <nav className={`nav${menu ? " open" : ""}`} aria-label="Əsas menyu">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="header__right">
            {user ? (
              <>
                <Notifications />
                <Link className="btn btn--sm" to={isStaff(user) ? "/admin" : "/kabinet"}>
                  {isStaff(user) ? "İnzibati panel" : "Kabinetim"}
                </Link>
                <div className="user-chip">
                  <span className="avatar">{initials(user.fullName)}</span>
                  <span className="user-chip__text">
                    <div className="user-chip__name">{user.fullName}</div>
                    <div className="user-chip__role">{user.roleLabel}</div>
                  </span>
                </div>
                <button className="icon-btn" aria-label="Çıxış" title="Çıxış" onClick={async () => { await logout(); nav("/"); }}>
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn--sm btn--quiet" to="/giris?tab=register">Qeydiyyat</Link>
                <Link className="btn btn--sm" to="/giris">Daxil ol</Link>
              </>
            )}
            <button className="icon-btn menu-toggle" aria-label="Menyu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <Brand light />
            <p style={{ marginTop: 16, maxWidth: 380 }}>
              İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı torpaqlarına investisiya müsabiqəsinin rəqəmsal platforması. Prototip, hakaton layihəsi.
            </p>
          </div>
          <div>
            <h4>İnvestorlar üçün</h4>
            <ul>
              <li><Link to="/xerite">Aqrar investisiya xəritəsi</Link></li>
              <li><Link to="/kataloq">İmkanlar kataloqu</Link></li>
              <li><Link to="/ai">AI məsləhətçi</Link></li>
              <li><Link to="/musabiqeler">Müsabiqələr</Link></li>
            </ul>
          </div>
          <div>
            <h4>Şəffaflıq</h4>
            <ul>
              <li><Link to="/seffafliq">Açıq statistika</Link></li>
              <li><a href="/swagger-ui.html">API sənədləri</a></li>
              <li><Link to="/haqqinda">Foto mənbələri</Link></li>
            </ul>
          </div>
          <div>
            <h4>Platforma</h4>
            <ul>
              <li><Link to="/giris">Daxil ol / Qeydiyyat</Link></li>
              <li><Link to="/kabinet">Şəxsi kabinet</Link></li>
              <li><Link to="/admin">İnzibati panel</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer__base">
          <span>© {new Date().getFullYear()} Aqrar İnvest prototipi. Məlumatlar nümayiş məqsədlidir.</span>
          <span>Fotolar: Wikimedia Commons (CC BY / CC BY-SA)</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <>
      <a href="#main" className="skip-link">Əsas məzmuna keç</a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
