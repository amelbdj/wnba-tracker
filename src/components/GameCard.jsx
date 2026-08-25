import { useState } from "react";
import { useTranslation } from "react-i18next";
import GameDetails from "./GameDetails";
import { toLocale } from "../utils/locale";

export default function GameCard({ game, league }) {
  const { t, i18n } = useTranslation();
  const comp = game.competitions[0];
  const [open, setOpen] = useState(false);

  const team1 = comp.competitors[0];
  const team2 = comp.competitors[1];

  const statusType = game.status?.type || {};
  const description = statusType.description || "";
  const isLive = statusType.state === "in" || description === "In Progress";
  const isFinal = statusType.state === "post" || description === "Final";

  const score1 = Number(team1.score);
  const score2 = Number(team2.score);
  const team1Wins = isFinal && score1 > score2;
  const team2Wins = isFinal && score2 > score1;

  const time = new Date(game.date).toLocaleTimeString(toLocale(i18n.language), {
    hour: "2-digit",
    minute: "2-digit",
  });

  const liveDetail =
    game.status?.displayClock && game.status?.period
      ? `Q${game.status.period} · ${game.status.displayClock}`
      : statusType.shortDetail || description;

  let statusLabel = description;
  if (isFinal) statusLabel = t("game.final");
  else if (statusType.state === "pre") statusLabel = t("game.scheduled");

  return (
    <>
      <div
        className={`card${isLive ? " is-live" : ""}`}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
      >
        <div className="card-head">
          {isLive ? (
            <span className="card-status live">
              <span className="dot"></span> {liveDetail || t("game.live")}
            </span>
          ) : (
            <span className="card-status">{statusLabel}</span>
          )}
          <span className="card-time">
            <i className="fa-regular fa-clock"></i> {time}
          </span>
        </div>

        <div className="card-matchup">
          <div className={`card-team${team1Wins ? " is-winner" : ""}`}>
            <div className="card-team-id">
              <img src={team1.team.logo} alt="" />
              <span className="card-team-name">{team1.team.displayName}</span>
            </div>
            <span className="card-team-score">{team1.score}</span>
          </div>

          <div className="card-divider"></div>

          <div className={`card-team${team2Wins ? " is-winner" : ""}`}>
            <div className="card-team-id">
              <img src={team2.team.logo} alt="" />
              <span className="card-team-name">{team2.team.displayName}</span>
            </div>
            <span className="card-team-score">{team2.score}</span>
          </div>
        </div>
      </div>

      {open && <GameDetails gameId={game.id} league={league} onClose={() => setOpen(false)} />}
    </>
  );
}
