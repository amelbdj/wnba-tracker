import { useState } from "react";
import { useTranslation } from "react-i18next";
import GameDetails from "./GameDetails";
import { getLeague } from "../leagues";
import { toLocale } from "../utils/locale";

export default function HeroGame({ game, league }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!game) {
    return (
      <section className="hero">
        <div className="hero-inner">
          <span className="hero-tag">
            <span className="dot"></span> {t(getLeague(league).labelKey)}
          </span>
          <div className="hero-empty">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {t("home.noGamesTitle")}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              {t("hero.noGameSubtitle")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const comp = game.competitions[0];
  const team1 = comp.competitors[0];
  const team2 = comp.competitors[1];

  const statusType = game.status?.type || {};
  const description = statusType.description || "";
  const isLive = statusType.state === "in" || description === "In Progress";
  const isFinal = statusType.state === "post" || description === "Final";

  const dateObj = new Date(game.date);
  const locale = toLocale(i18n.language);
  const time = dateObj.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const day = dateObj.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  const liveDetail =
    game.status?.displayClock && game.status?.period
      ? `Q${game.status.period} · ${game.status.displayClock}`
      : statusType.shortDetail || description;

  let headline = t("hero.nextGame");
  if (isLive) headline = t("hero.liveGame");
  else if (isFinal) headline = t("hero.lastResult");

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <span className={`hero-tag${isLive ? " is-live" : ""}`}>
              <span className="dot"></span>
              {isLive ? liveDetail || t("hero.live") : isFinal ? t("hero.final") : t("hero.upcoming")}
            </span>
          </div>

          <h1 className="hero-headline">{headline}</h1>

          <div className="hero-matchup">
            <div className="hero-team">
              <img src={team1.team.logo} alt="" />
              <span className="hero-team-name">{team1.team.displayName}</span>
              {team1.records?.[0]?.summary && (
                <span className="hero-team-record">{team1.records[0].summary}</span>
              )}
            </div>

            <div className="hero-center">
              {isFinal || isLive ? (
                <span className="hero-score">
                  {team1.score} – {team2.score}
                </span>
              ) : (
                <span className="hero-vs">VS</span>
              )}
              <span className="hero-meta">
                <i className="fa-regular fa-calendar"></i>
                {isFinal ? t("hero.final") : `${day} · ${time}`}
              </span>
            </div>

            <div className="hero-team">
              <img src={team2.team.logo} alt="" />
              <span className="hero-team-name">{team2.team.displayName}</span>
              {team2.records?.[0]?.summary && (
                <span className="hero-team-record">{team2.records[0].summary}</span>
              )}
            </div>
          </div>

          <div className="hero-bottom">
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              <i className="fa-solid fa-chart-simple"></i> {t("common.viewStats")}
            </button>
          </div>
        </div>
      </section>

      {open && <GameDetails gameId={game.id} league={league} onClose={() => setOpen(false)} />}
    </>
  );
}
