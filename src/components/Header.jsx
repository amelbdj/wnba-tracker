import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "fa-solid fa-house" },
  { to: "/standings", label: "Classement", icon: "fa-solid fa-ranking-star" },
  { label: "Équipes", icon: "fa-solid fa-people-group", soon: true },
  { label: "Joueuses", icon: "fa-solid fa-star", soon: true },
  { label: "Stats", icon: "fa-solid fa-chart-simple", soon: true },
];

export default function Header() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <i className="fa-solid fa-basketball"></i>
          </span>
          <span className="brand-text">
            WNBA Tracker
            <small>LIVE SCORES &amp; STANDINGS</small>
          </span>
        </Link>

        <nav className="main-nav">
          {NAV_ITEMS.map((item) =>
            item.soon ? (
              <span key={item.label} className="nav-item disabled">
                <i className={item.icon}></i>
                {item.label}
                <span className="nav-soon">Bientôt</span>
              </span>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item${location.pathname === item.to ? " active" : ""}`}
              >
                <i className={item.icon}></i>
                {item.label}
              </Link>
            ),
          )}
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
          {NAV_ITEMS.map((item) =>
            item.soon ? (
              <span key={item.label} className="nav-item disabled">
                <i className={item.icon}></i>
                {item.label}
                <span className="nav-soon">Bientôt</span>
              </span>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item${location.pathname === item.to ? " active" : ""}`}
              >
                <i className={item.icon}></i>
                {item.label}
              </Link>
            ),
          )}
        </nav>
      )}
    </header>
  );
}
