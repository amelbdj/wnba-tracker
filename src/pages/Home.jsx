import { useEffect, useState } from "react";
import { getGamesByDate } from "../services/api";
import GameCard from "../components/GameCard";

function formatDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export default function Home() {
  const [date, setDate] = useState(new Date());
  const [games, setGames] = useState([]);

  async function loadGames() {
    const formatted = formatDate(date);
    const data = await getGamesByDate(formatted);
    setGames(data);
  }

  useEffect(() => {
    loadGames();
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

  return (
    <div className="container">
      <h1>
        <i className="fa-solid fa-basketball icon"></i>
        WNBA Tracker
      </h1>

      <div className="date-nav">
        <button onClick={prevDay}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>

        <span>
          <i className="fa-regular fa-calendar"></i> {date.toDateString()}
        </span>

        <button onClick={nextDay}>
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <div className="games-list">
        {games.length === 0 ? (
          <p>Aucun match</p>
        ) : (
          games.map((game) => <GameCard key={game.id} game={game} />)
        )}
      </div>
    </div>
  );
}
