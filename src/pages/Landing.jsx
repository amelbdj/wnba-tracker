import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGamesByDate, getLeagueLeaders } from "../services/api";
import { formatDateParam, getFeaturedGame } from "../utils/games";
import { LEAGUES } from "../leagues";
import Logo from "../components/Logo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import InstagramLink from "../components/InstagramLink";
import HeroGame from "../components/HeroGame";
import GameCard from "../components/GameCard";
import PlayerCard from "../components/PlayerCard";
import Standings from "../components/Standings";

const FUTURE_SPORTS = [
  { key: "soccer", icon: "fa-solid fa-futbol" },
  { key: "tennis", icon: "fa-solid fa-table-tennis-paddle-ball" },
  { key: "volleyball", icon: "fa-solid fa-volleyball" },
  { key: "athletics", icon: "fa-solid fa-person-running" },
];

export default function Landing() {
  const { t } = useTranslation();
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [leaders, setLeaders] = useState([]);
  const [loadingLeaders, setLoadingLeaders] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getGamesByDate("wnba", formatDateParam(new Date()));
      setGames(data || []);
      setLoadingGames(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function load() {
      const categories = await getLeagueLeaders("wnba");
      const points = categories.find((c) => c.name === "pointsPerGame");
      setLeaders(points?.leaders?.slice(0, 4) || []);
      setLoadingLeaders(false);
    }
    load();
  }, []);

  const featuredGame = getFeaturedGame(games);
  const otherGames = games.filter((g) => g.id !== featuredGame?.id).slice(0, 3);
  const isLiveFeatured = featuredGame?.status?.type?.state === "in";

  return (
    <>
      <header className="site-header landing-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <Logo size={30} />
            <span className="brand-text">
              FRONTROW
              <small>The home of women's sports.</small>
            </span>
          </Link>

          <div className="header-right">
            <InstagramLink />
            <LanguageSwitcher />
            <Link to="/wnba" className="btn btn-primary landing-enter-btn">
              {t("landing.enter")} <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </div>
      </header>

      <div className="page">
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-logo">
              <Logo size={56} />
            </div>

            {isLiveFeatured && (
              <Link to="/wnba" className="landing-live-pill">
                <span className="dot"></span>
                {featuredGame.competitions[0].competitors[0].team.displayName} vs{" "}
                {featuredGame.competitions[0].competitors[1].team.displayName}
              </Link>
            )}

            <h1 className="landing-hero-title">The home of women's sports.</h1>
            <p className="landing-hero-subtitle">{t("landing.heroSubtitle")}</p>

            <div className="landing-hero-actions">
              <Link to="/wnba" className="btn btn-primary">
                <i className="fa-solid fa-basketball"></i> {t("landing.ctaPrimary")}
              </Link>
              <a href="#competitions" className="btn btn-ghost">
                {t("landing.ctaSecondary")}
              </a>
            </div>
          </div>
        </section>

        <div className="container-wide">
          <div className="section">
            <div className="section-head">
              <span className="section-eyebrow">
                <i className="fa-solid fa-basketball"></i> WNBA · {t("landing.featured")}
              </span>
            </div>

            {loadingGames ? (
              <div className="skeleton skeleton-card"></div>
            ) : (
              <HeroGame game={featuredGame} league="wnba" />
            )}
          </div>

          {!loadingGames && otherGames.length > 0 && (
            <div className="section">
              <div className="games-grid">
                {otherGames.map((game) => (
                  <GameCard key={game.id} game={game} league="wnba" />
                ))}
              </div>
            </div>
          )}

          <div className="section" id="competitions">
            <div className="section-head">
              <div>
                <span className="section-eyebrow">{t("landing.competitionsEyebrow")}</span>
                <div className="section-title">{t("landing.competitionsTitle")}</div>
              </div>
            </div>
            <p className="landing-section-subtitle">{t("landing.competitionsSubtitle")}</p>

            <div className="competition-grid">
              {LEAGUES.map((l) => (
                <Link key={l.slug} to={`/${l.slug}`} className="competition-card">
                  <div className="competition-card-icon">
                    <i className={l.icon}></i>
                  </div>
                  <div className="competition-card-name">{t(l.labelKey)}</div>
                  <div className="competition-card-blurb">
                    {t(l.labelKey.replace("league.", "leagueBlurb."))}
                  </div>
                  <i className="fa-solid fa-arrow-right competition-card-arrow"></i>
                </Link>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <div>
                <span className="section-eyebrow">{t("landing.watchEyebrow")}</span>
                <div className="section-title">{t("landing.watchTitle")}</div>
              </div>
              <Link to="/wnba/statistics" className="section-link">
                {t("common.viewStats")} <i className="fa-solid fa-arrow-right"></i>
              </Link>
            </div>

            {loadingLeaders ? (
              <div className="player-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton skeleton-card"></div>
                ))}
              </div>
            ) : (
              <div className="player-grid">
                {leaders.map((leader) => (
                  <PlayerCard
                    key={leader.athlete.id}
                    player={{ ...leader.athlete, team: leader.team }}
                    league="wnba"
                    statValue={leader.displayValue}
                    statLabel="PPG"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-head">
              <div>
                <span className="section-eyebrow">
                  <i className="fa-solid fa-ranking-star"></i> WNBA
                </span>
                <div className="section-title">{t("home.topOfLeague")}</div>
              </div>
              <Link to="/wnba/standings" className="section-link">
                {t("home.fullStandings")} <i className="fa-solid fa-arrow-right"></i>
              </Link>
            </div>

            <Standings league="wnba" limit={5} />
          </div>

          <div className="section landing-future">
            <span className="section-eyebrow">{t("landing.futureEyebrow")}</span>
            <h2 className="landing-future-title">{t("landing.futureTitle")}</h2>
            <p className="landing-future-subtitle">{t("landing.futureSubtitle")}</p>

            <div className="future-sport-chips">
              {FUTURE_SPORTS.map((sport) => (
                <span key={sport.key} className="future-sport-chip">
                  <i className={sport.icon}></i>
                  {t(`futureSports.${sport.key}`)}
                  <span className="nav-soon">{t("nav.comingSoon")}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <footer className="landing-footer">
          <Logo size={26} />
          <div>
            <div className="landing-footer-brand">FRONTROW</div>
            <div className="landing-footer-note">{t("landing.footerNote")}</div>
          </div>
          <InstagramLink className="landing-footer-social" />
        </footer>
      </div>
    </>
  );
}
