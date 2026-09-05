import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LEAGUES, getLeague } from "../leagues";
import { LANGUAGES } from "../i18n";
import Logo from "./Logo";
import LanguageSwitcher, { MobileLangChip } from "./LanguageSwitcher";
import InstagramLink from "./InstagramLink";
import TikTokLink from "./TikTokLink";

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
  const { t } = useTranslation();
  const NAV_ITEMS = [
    { section: "", label: t("nav.dashboard"), icon: "fa-solid fa-house" },
    { section: "standings", label: t("nav.standings"), icon: "fa-solid fa-ranking-star" },
    { section: "playoffs", label: t("nav.playoffs"), icon: "fa-solid fa-trophy" },
    { section: "teams", label: t("nav.teams"), icon: "fa-solid fa-people-group" },
    { section: "players", label: t("nav.players"), icon: "fa-solid fa-star" },
    { section: "statistics", label: t("nav.stats"), icon: "fa-solid fa-chart-simple" },
  ];

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
  const { t } = useTranslation();
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
                {t(l.labelKey)}
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
  const { t } = useTranslation();
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

        <div className="header-right">
          <InstagramLink />
          <TikTokLink />
          <LanguageSwitcher />

          <button
            className="nav-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("nav.openMenu")}
            aria-expanded={open}
          >
            <i className={open ? "fa-solid fa-xmark" : "fa-solid fa-bars"}></i>
          </button>
        </div>
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
          <div className="chip-group" style={{ marginBottom: 14 }}>
            {LANGUAGES.map((l) => (
              <MobileLangChip key={l.code} lang={l} />
            ))}
          </div>
          <NavLinks pathname={location.pathname} league={league} />
        </nav>
      )}
    </header>
  );
}
