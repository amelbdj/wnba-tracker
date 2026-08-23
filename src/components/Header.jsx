import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { LEAGUES, getLeague } from "../leagues";
import Logo from "./Logo";

const NAV_ITEMS = [
  { section: "", label: "Dashboard", icon: "fa-solid fa-house" },
  { section: "standings", label: "Classement", icon: "fa-solid fa-ranking-star" },
  { section: "teams", label: "Équipes", icon: "fa-solid fa-people-group" },
  { section: "players", label: "Joueuses", icon: "fa-solid fa-star" },
  { section: "statistics", label: "Stats", icon: "fa-solid fa-chart-simple" },
];

function isActive(pathname, league, section) {
  const to = section ? `/${league}/${section}` : `/${league}`;
  if (!section) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function currentSection(pathname, league) {
  const rest = pathname.replace(`/${league}`, "").replace(/^\//, "");
  return rest.split("/")[0] || "";
}

function NavLinks({ pathname, league }) {
  return NAV_ITEMS.map((item) => (
    <Link
      key={item.section}
      to={item.section ? `/${league}/${item.section}` : `/${league}`}
      className={`nav-item${isActive(pathname, league, item.section) ? " active" : ""}`}
    >
      <i className={item.icon}></i>
      {item.label}
    </Link>
  ));
}

function LeagueSwitcher({ league, pathname }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const current = getLeague(league);

  function goTo(newLeague) {
    setOpen(false);
    if (newLeague === league) return;
    const section = currentSection(pathname, league);
    navigate(section ? `/${newLeague}/${section}` : `/${newLeague}`);
  }

  return (
    <div className="league-switcher">
      <button
        className={`league-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <i className={current.icon}></i>
        {current.shortLabel}
        <i className="fa-solid fa-chevron-down chevron"></i>
      </button>

      {open && (
        <>
          <div className="league-menu-backdrop" onClick={() => setOpen(false)}></div>
          <div className="league-menu" role="listbox">
            {LEAGUES.map((l) => (
              <button
                key={l.slug}
                className={`league-option${l.slug === league ? " active" : ""}`}
                onClick={() => goTo(l.slug)}
                role="option"
                aria-selected={l.slug === league}
              >
                <i className={l.icon}></i>
                {l.label}
                {l.slug === league && <i className="fa-solid fa-check check"></i>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Header() {
  const { league } = useParams();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="header-left">
          <Link to={`/${league}`} className="brand">
            <Logo size={30} />
            <span className="brand-text">
              FRONTROW
              <small>The home of women's sports.</small>
            </span>
          </Link>

          <LeagueSwitcher league={league} pathname={location.pathname} />
        </div>

        <nav className="main-nav">
          <NavLinks pathname={location.pathname} league={league} />
        </nav>

        <button
          className="nav-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
        >
          <i className={open ? "fa-solid fa-xmark" : "fa-solid fa-bars"}></i>
        </button>
      </div>

      {open && (
        <nav className="mobile-nav">
          <div className="chip-group" style={{ marginBottom: 14 }}>
            {LEAGUES.map((l) => (
              <Link
                key={l.slug}
                to={`/${l.slug}`}
                className={`chip${l.slug === league ? " active" : ""}`}
              >
                <i className={l.icon}></i> {l.shortLabel}
              </Link>
            ))}
          </div>
          <NavLinks pathname={location.pathname} league={league} />
        </nav>
      )}
    </header>
  );
}
