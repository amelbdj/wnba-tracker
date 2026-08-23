import { useEffect, useState } from "react";
import { getGamesByDate } from "../services/api";
import GameCard from "../components/GameCard";
import HeroGame from "../components/HeroGame";
import Standings from "../components/Standings";
import { Link } from "react-router-dom";

function formatDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function isSameDay(a, b) {
  return formatDate(a) === formatDate(b);
}

function getFeaturedGame(games) {
  if (!games.length) return null;

  const live = games.find((g) => g.status?.type?.state === "in");
  if (live) return live;

  const upcoming = games
    .filter((g) => g.status?.type?.state === "pre")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (upcoming.length) return upcoming[0];

  const final = games.find((g) => g.status?.type?.state === "post");
  if (final) return final;

  return games[0];
}

export default function Home() {
  const [date, setDate] = useState(new Date());
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadGames() {
    setLoading(true);
    const formatted = formatDate(date);
    const data = await getGamesByDate(formatted);
    setGames(data || []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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
      {loading ? (
        <div className="skeleton skeleton-card"></div>
      ) : (
        <HeroGame game={featuredGame} />
      )}

      <div className="section">
        <div className="date-nav">
          <button className="icon-btn" onClick={prevDay} aria-label="Jour précédent">
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          <div className="date-nav-label">
            <span className="day">
              {date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            {!today && (
              <button className="date-today-btn" onClick={() => setDate(new Date())}>
                Revenir à aujourd'hui
              </button>
            )}
            {today && <span className="sub">Aujourd'hui</span>}
          </div>

          <button className="icon-btn" onClick={nextDay} aria-label="Jour suivant">
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-basketball"></i> Matchs du jour
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
            <strong>Aucun match ce jour-là</strong>
            <span>Essaie une autre date pour voir le calendrier de la ligue.</span>
          </div>
        ) : (
          <div className="games-grid">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-ranking-star"></i> Classement
            </span>
            <div className="section-title">Le top de la ligue</div>
          </div>
          <Link to="/standings" className="section-link">
            Classement complet <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        <Standings limit={5} />
      </div>
    </div>
  );
}
