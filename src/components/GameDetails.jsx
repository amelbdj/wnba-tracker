import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getGameDetails } from "../services/api";
import { getSport } from "../leagues";
import { getSetScores } from "../utils/games";
import VolleyballBoxscore from "./VolleyballBoxscore";

const LIVE_REFRESH_MS = 20 * 1000;

function parseNumeric(displayValue) {
  const match = String(displayValue).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function formatStatName(name) {
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
}

function VolleyballScoreboard({ competition, onClose }) {
  const { t } = useTranslation();
  const sets = getSetScores(competition);
  const [a, b] = competition.competitors;
  const live = competition.status?.type?.state === "in";

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t("modal.setScores")}</span>
          <button className="close-btn" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="set-table-wrap">
          <table className="set-table">
            <thead>
              <tr>
                <th></th>
                {sets.map((_, i) => (
                  <th key={i}>{i + 1}</th>
                ))}
                <th>{t("modal.setsWon")}</th>
              </tr>
            </thead>
            <tbody>
              {[a, b].map((team, side) => {
                const opponent = side === 0 ? b : a;
                return (
                  <tr key={team.team.id} className={team.winner ? "is-winner" : ""}>
                    <td className="set-table-team">
                      <img src={team.team.logos?.[0]?.href || team.team.logo} alt="" />
                      <span>{team.team.displayName}</span>
                    </td>
                    {sets.map((pair, i) => {
                      const mine = pair[side];
                      const theirs = pair[1 - side];
                      const current = live && i === sets.length - 1;
                      return (
                        <td key={i} className={!current && mine > theirs ? "set-won" : ""}>
                          {mine}
                        </td>
                      );
                    })}
                    <td className="set-table-total">{team.score ?? opponent.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <VolleyballBoxscore competition={competition} live={live} />
      </div>
    </div>
  );
}

export default function GameDetails({ gameId, league, onClose }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  // Loads the box score, then keeps refreshing it every 20s for as long as
  // the game is in progress (and the tab is visible), so the open modal
  // follows the game live instead of freezing at the moment it was opened.
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function load() {
      if (document.hidden) {
        timer = setTimeout(load, LIVE_REFRESH_MS);
        return;
      }
      try {
        const res = await getGameDetails(league, gameId);
        if (cancelled) return;
        setData(res);
        const state = res?.header?.competitions?.[0]?.status?.type?.state;
        if (state === "in") timer = setTimeout(load, LIVE_REFRESH_MS);
      } catch {
        // Keep whatever is on screen and try again shortly.
        if (!cancelled) timer = setTimeout(load, LIVE_REFRESH_MS);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gameId, league]);

  const isVolleyball = getSport(league) === "volleyball";

  // ESPN's volleyball box score carries no team stats at all, only the
  // header — so volleyball shows the set-by-set scoreboard instead.
  if (isVolleyball && data?.header?.competitions?.[0]?.competitors) {
    return <VolleyballScoreboard competition={data.header.competitions[0]} onClose={onClose} />;
  }

  if (!data || !data.boxscore || !data.boxscore.teams) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-loading">
            <div className="spinner"></div>
            <span>{t("common.loadingStats")}</span>
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
          <span className="modal-title">{t("modal.gameStats")}</span>
          <button className="close-btn" onClick={onClose} aria-label={t("common.close")}>
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
