import { useTranslation } from "react-i18next";
import { getGameStatus, getLiveDetail, getShootoutScore } from "../utils/games";
import { buildLineup, buildTimeline, pairStats } from "../utils/soccerMatch";
import Modal from "./Modal";
import TeamLink from "./TeamLink";

const sameTeam = (a, b) => String(a?.team?.id ?? a?.id) === String(b?.team?.id ?? b?.id);

function EventRow({ row, t }) {
  const icon = {
    goal: <i className="fa-solid fa-futbol event-icon goal"></i>,
    penaltyGoal: <i className="fa-solid fa-futbol event-icon goal"></i>,
    ownGoal: <i className="fa-solid fa-futbol event-icon own"></i>,
    penaltyMissed: <i className="fa-solid fa-xmark event-icon missed"></i>,
    yellow: <span className="card-icon yellow"></span>,
    red: <span className="card-icon red"></span>,
    sub: <i className="fa-solid fa-right-left event-icon sub"></i>,
  }[row.kind];

  const note =
    row.kind === "penaltyGoal"
      ? t("soccerMatch.penalty")
      : row.kind === "ownGoal"
        ? t("soccerMatch.ownGoal")
        : row.kind === "penaltyMissed"
          ? t("soccerMatch.penaltyMissed")
          : null;

  const detail =
    row.kind === "sub" ? (
      <span className="event-sub">
        <span className="in">
          <i className="fa-solid fa-arrow-up"></i> {row.player}
        </span>
        {row.other && (
          <span className="out">
            <i className="fa-solid fa-arrow-down"></i> {row.other}
          </span>
        )}
      </span>
    ) : (
      <>
        <span className="event-name">{row.player}</span>
        {note && <span className="event-note">{note}</span>}
        {row.other && (row.kind === "goal" || row.kind === "penaltyGoal") && (
          <span className="event-note">{t("soccerMatch.assist", { name: row.other })}</span>
        )}
      </>
    );

  return (
    <div className={`event-row ${row.side}`}>
      <div className="event-side home">{row.side === "home" && <div className="event-body">{icon}{detail}</div>}</div>
      <span className="event-minute">{row.minute}</span>
      <div className="event-side away">{row.side === "away" && <div className="event-body">{icon}{detail}</div>}</div>
    </div>
  );
}

function LineupColumn({ team, lineup, t }) {
  const player = (p) => (
    <li key={`${p.id}-${p.jersey}`} className="lineup-player">
      <span className="lineup-jersey">{p.jersey}</span>
      <span className="lineup-name">{p.name}</span>
      {p.position && <span className="position-badge">{p.position}</span>}
      {p.subbedOut && <i className="fa-solid fa-arrow-down lineup-out" title={t("soccerMatch.subbedOff")}></i>}
      {p.subbedIn && <i className="fa-solid fa-arrow-up lineup-in" title={t("soccerMatch.subbedOn")}></i>}
    </li>
  );

  return (
    <div className="lineup-col">
      <div className="lineup-head">
        <span>{team.shortDisplayName || team.displayName}</span>
        {lineup.formation && <span className="lineup-formation">{lineup.formation}</span>}
      </div>
      <ul className="lineup-list">{lineup.starters.map(player)}</ul>
      {lineup.bench.length > 0 && (
        <>
          <div className="lineup-bench">{t("soccerMatch.bench")}</div>
          <ul className="lineup-list bench">{lineup.bench.map(player)}</ul>
        </>
      )}
    </div>
  );
}

// Match detail for football: score and status, the goals / cards /
// substitutions as a timeline, team statistics, and the line-ups. `data` is
// ESPN's match summary (kept fresh by GameDetails while the match is on).
export default function SoccerMatch({ data, league, onClose }) {
  const { t } = useTranslation();
  const competition = data.header.competitions[0];
  const home = competition.competitors.find((c) => c.homeAway === "home") || competition.competitors[0];
  const away = competition.competitors.find((c) => c !== home);

  const game = { status: competition.status };
  const { isLive, isFinal, label } = getGameStatus(game, t);
  const started = isLive || isFinal;
  const statusText = isLive ? getLiveDetail(game, "soccer", t) || t("game.live") : label;
  const shootout = [getShootoutScore(home), getShootoutScore(away)];

  const timeline = buildTimeline(data.keyEvents, home.team.id);
  const teamStats = [home, away].map((c) => data.boxscore?.teams?.find((team) => sameTeam(team, c)));
  const stats = pairStats(teamStats);
  const lineups = [home, away].map((c) => buildLineup(data.rosters?.find((r) => sameTeam(r, c))));

  const venue = [data.gameInfo?.venue?.fullName, data.gameInfo?.venue?.address?.city].filter(Boolean).join(" · ");

  return (
    <Modal onClose={onClose} label={t("modal.gameStats")} className="modal-content-wide">
      <div className="modal-head">
        <span className="modal-title">{t("modal.gameStats")}</span>
        <button className="close-btn" onClick={onClose} aria-label={t("common.close")}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="matchup-strip soccer-strip">
        <TeamLink league={league} teamId={home.team.id} className="team-mini">
          <img src={home.team.logos?.[0]?.href || home.team.logo} alt="" />
          <span className="team-mini-name">{home.team.displayName}</span>
        </TeamLink>

        <div className="soccer-score">
          {started ? (
            <span className="soccer-score-value">
              {home.score} – {away.score}
            </span>
          ) : (
            <span className="vs">VS</span>
          )}
          <span className={`soccer-score-status${isLive ? " live" : ""}`}>{statusText}</span>
          {shootout[0] != null && (
            <span className="soccer-score-pens">{t("game.shootout", { a: shootout[0], b: shootout[1] })}</span>
          )}
        </div>

        <TeamLink league={league} teamId={away.team.id} className="team-mini">
          <img src={away.team.logos?.[0]?.href || away.team.logo} alt="" />
          <span className="team-mini-name">{away.team.displayName}</span>
        </TeamLink>
      </div>
      {venue && <p className="soccer-venue">{venue}</p>}

      {!started && timeline.length === 0 && stats.length === 0 && (
        <p className="vb-note">{t("soccerMatch.notStarted")}</p>
      )}

      {started && (
        <div className="soccer-section">
          <div className="modal-subtitle">{t("soccerMatch.events")}</div>
          {timeline.length === 0 ? (
            <p className="vb-note">{t("soccerMatch.noEvents")}</p>
          ) : (
            <div className="soccer-events">
              {timeline.map((row) => (
                <EventRow key={row.id} row={row} t={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <div className="soccer-section">
          <div className="modal-subtitle">{t("soccerMatch.stats")}</div>
          <div className="stat-block">
            {stats.map((stat) => {
              const total = stat.homeValue + stat.awayValue;
              const homeShare = total > 0 ? (stat.homeValue / total) * 100 : 50;
              return (
                <div key={stat.name} className="stat-compare-row">
                  <div className="stat-compare-label">{t(`soccerMatch.stat.${stat.name}`)}</div>
                  <div className="stat-compare-values">
                    <span>{stat.home}</span>
                    <i className="fa-solid fa-minus" style={{ fontSize: 8, color: "var(--muted)" }}></i>
                    <span>{stat.away}</span>
                  </div>
                  <div className="stat-compare-bar">
                    <div className="left" style={{ width: `${homeShare}%` }}></div>
                    <div className="right" style={{ width: `${100 - homeShare}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {lineups[0] && lineups[1] && (
        <div className="soccer-section">
          <div className="modal-subtitle">{t("soccerMatch.lineups")}</div>
          <div className="lineup-grid">
            <LineupColumn team={home.team} lineup={lineups[0]} t={t} />
            <LineupColumn team={away.team} lineup={lineups[1]} t={t} />
          </div>
        </div>
      )}
    </Modal>
  );
}
