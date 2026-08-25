import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGamesByDate } from "../services/api";
import GameCard from "../components/GameCard";
import HeroGame from "../components/HeroGame";
import Standings from "../components/Standings";
import { toLocale } from "../utils/locale";
import { formatDateParam, getFeaturedGame } from "../utils/games";

function isSameDay(a, b) {
  return formatDateParam(a) === formatDateParam(b);
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const { league } = useParams();
  const [date, setDate] = useState(new Date());
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadGames() {
    setLoading(true);
    const formatted = formatDateParam(date);
    const data = await getGamesByDate(league, formatted);
    setGames(data || []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, league]);

  function prevDay() {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() - 1);
    setDate(newDate);
  }

  function nextDay() {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + 1);
    setDate(newDate);
  }

  const featuredGame = getFeaturedGame(games);
  const today = isSameDay(date, new Date());

  return (
    <div className="container-wide">
      <div className="brand-kicker">
        <span className="brand-kicker-mark">FRONTROW</span>
        <span className="brand-kicker-divider"></span>
        <span className="brand-kicker-tagline">The home of women's sports.</span>
      </div>

      {loading ? (
        <div className="skeleton skeleton-card"></div>
      ) : (
        <HeroGame game={featuredGame} league={league} />
      )}

      <div className="section">
        <div className="date-nav">
          <button className="icon-btn" onClick={prevDay} aria-label={t("home.prevDay")}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          <div className="date-nav-label">
            <span className="day">
              {date.toLocaleDateString(toLocale(i18n.language), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            {!today && (
              <button className="date-today-btn" onClick={() => setDate(new Date())}>
                {t("home.backToToday")}
              </button>
            )}
            {today && <span className="sub">{t("home.today")}</span>}
          </div>

          <button className="icon-btn" onClick={nextDay} aria-label={t("home.nextDay")}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-basketball"></i> {t("home.gamesToday")}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="games-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-card"></div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-basketball"></i>
            <strong>{t("home.noGamesTitle")}</strong>
            <span>{t("home.noGamesSubtitle")}</span>
          </div>
        ) : (
          <div className="games-grid">
            {games.map((game) => (
              <GameCard key={game.id} game={game} league={league} />
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-ranking-star"></i> {t("nav.standings")}
            </span>
            <div className="section-title">{t("home.topOfLeague")}</div>
          </div>
          <Link to={`/${league}/standings`} className="section-link">
            {t("home.fullStandings")} <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        <Standings league={league} limit={5} />
      </div>
    </div>
  );
}
