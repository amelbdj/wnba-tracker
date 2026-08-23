import { useEffect, useState } from "react";
import { getGameDetails } from "../services/api";

function parseNumeric(displayValue) {
  const match = String(displayValue).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function formatStatName(name) {
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
}

export default function GameDetails({ gameId, league, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      const res = await getGameDetails(league, gameId);
      setData(res);
    }
    load();
  }, [gameId, league]);

  if (!data || !data.boxscore || !data.boxscore.teams) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-loading">
            <div className="spinner"></div>
            <span>Chargement des stats...</span>
          </div>
        </div>
      </div>
    );
  }

  const teams = data.boxscore.teams;
  const [teamA, teamB] = teams;
  const statsA = teamA?.statistics || [];
  const statsB = teamB?.statistics || [];
  const pairedStats = statsA.map((stat, idx) => ({
    name: stat.name,
    a: stat.displayValue,
    b: statsB[idx]?.displayValue,
  }));

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Statistiques du match</span>
          <button className="close-btn" onClick={onClose} aria-label="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {teamA && teamB && (
          <div className="matchup-strip">
            <div className="team-mini">
              <img src={teamA.team.logo} alt="" />
              <span className="team-mini-name">{teamA.team.displayName}</span>
            </div>
            <span className="vs">VS</span>
            <div className="team-mini">
              <img src={teamB.team.logo} alt="" />
              <span className="team-mini-name">{teamB.team.displayName}</span>
            </div>
          </div>
        )}

        <div className="stat-block">
          {pairedStats.map((stat, idx) => {
            const a = parseNumeric(stat.a);
            const b = parseNumeric(stat.b);
            const total = a !== null && b !== null ? a + b : 0;
            const pctA = total > 0 ? (a / total) * 100 : 50;
            const pctB = total > 0 ? (b / total) * 100 : 50;

            return (
              <div key={idx} className="stat-compare-row">
                <div className="stat-compare-label">{formatStatName(stat.name)}</div>
                <div className="stat-compare-values">
                  <span>{stat.a}</span>
                  <i className="fa-solid fa-minus" style={{ fontSize: 8, color: "var(--muted)" }}></i>
                  <span>{stat.b}</span>
                </div>
                <div className="stat-compare-bar">
                  <div className="left" style={{ width: `${pctA}%` }}></div>
                  <div className="right" style={{ width: `${pctB}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
