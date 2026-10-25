import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getTeamDetails } from "../services/api";
import { useTeamSeason } from "../services/volleyballSeason";
import { buildPlayerSeason } from "../utils/volleyballBoxscore";
import { toLocale } from "../utils/locale";
import TeamLink from "../components/TeamLink";

const TREND_MATCHES = 8;

// [stat key, label key under modal.box] for the season-totals tiles.
const TOTAL_TILES = [
  ["points", "pts"],
  ["kills", "kills"],
  ["pct", "pct"],
  ["assists", "assists"],
  ["aces", "aces"],
  ["digs", "digs"],
  ["blocks", "blocks"],
];

const LOG_COLUMNS = ["points", "kills", "errors", "attempts", "pct", "assists", "aces", "digs", "blocks"];
const BOX_LABEL = { points: "pts", pct: "pct" };
const boxLabel = (key) => BOX_LABEL[key] || key;

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Volleyball player page. There is no profile endpoint for these players, so
// everything is computed from the box scores of the team's finished matches.
export default function VolleyballPlayerPage() {
  const { t, i18n } = useTranslation();
  const { league, teamId, slug } = useParams();
  const [team, setTeam] = useState(null);
  const progress = useTeamSeason(league, teamId);
  const season = useMemo(() => buildPlayerSeason(progress.matches, slug), [progress.matches, slug]);

  useEffect(() => {
    let cancelled = false;
    getTeamDetails(league, teamId)
      .then((details) => {
        if (!cancelled) setTeam(details);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [league, teamId]);

  // Matches arrive newest first and the page fills in as they do, so it only
  // has to wait when the player isn't in any of them yet.
  if (!season && !progress.done && !progress.error) {
    return (
      <div className="container">
        <div className="skeleton skeleton-card" style={{ height: 220 }}></div>
        <p className="vb-note">
          <span className="tiktok-spinner"></span> {t("volleyballPlayer.loading")}
          {progress.total ? ` ${progress.fetched}/${progress.total}` : ""}
        </p>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="container">
        <Link to={`/${league}/teams/${teamId}`} className="nav-btn">
          <i className="fa-solid fa-arrow-left"></i> {t("common.viewTeam")}
        </Link>
        <div className="empty-state" style={{ marginTop: 20 }}>
          <i className="fa-solid fa-person"></i>
          <strong>{t("player.notFound")}</strong>
          <span>{t("player.notFoundSubtitle")}</span>
        </div>
      </div>
    );
  }

  const { totals, perSet, games } = season;
  const locale = toLocale(i18n.language);
  const teamLogo = team?.logos?.[0]?.href;
  const trend = games.slice(0, TREND_MATCHES).reverse();
  const maxPoints = Math.max(1, ...trend.map((g) => g.stats.points));
  const formatDate = (date) =>
    new Date(date).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  return (
    <div className="container">
      <Link to={`/${league}/teams/${teamId}`} className="nav-btn">
        <i className="fa-solid fa-arrow-left"></i> {team?.displayName || t("common.viewTeam")}
      </Link>

      <section className="hero profile-hero" style={{ marginTop: 20 }}>
        <div className="hero-inner profile-hero-inner">
          <div className="profile-photo-wrap profile-initials" aria-hidden="true">
            {initials(season.name)}
            {season.number && <span className="profile-jersey">#{season.number}</span>}
          </div>

          <div className="profile-info">
            {season.position && <span className="hero-tag">{season.position}</span>}
            <h1 className="hero-headline" style={{ marginTop: 12, marginBottom: 0 }}>
              {season.name}
            </h1>
            {team && (
              <div className="profile-meta-row">
                <TeamLink league={league} teamId={teamId}>
                  {teamLogo && <img src={teamLogo} alt="" />}
                  {team.displayName}
                </TeamLink>
              </div>
            )}
          </div>
        </div>
      </section>

      {!progress.done && !progress.error && (
        <p className="vb-note vb-progress">
          <span className="tiktok-spinner"></span> {t("volleyballPlayer.loading")} {progress.fetched}/
          {progress.total}
        </p>
      )}

      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-chart-simple"></i> {t("volleyballPlayer.seasonTotals")}
            </span>
          </div>
        </div>
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="stat-tile-value">{totals.matches}</div>
            <div className="stat-tile-label">{t("volleyballPlayer.matches")}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile-value">{totals.sets}</div>
            <div className="stat-tile-label">{t("volleyballPlayer.sets")}</div>
          </div>
          {TOTAL_TILES.map(([key, label]) => (
            <div key={key} className="stat-tile" title={t(`modal.box.${label}Title`)}>
              <div className="stat-tile-value">{totals[key]}</div>
              <div className="stat-tile-label">{t(`modal.box.${label}`)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-gauge-high"></i> {t("volleyballPlayer.perSet")}
            </span>
          </div>
        </div>
        <div className="stat-tiles">
          {["points", "kills", "assists", "aces", "digs", "blocks"].map((key) => (
            <div key={key} className="stat-tile" title={t(`modal.box.${boxLabel(key)}Title`)}>
              <div className="stat-tile-value">{perSet[key]}</div>
              <div className="stat-tile-label">{t(`modal.box.${boxLabel(key)}`)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-chart-line"></i> {t("player.pointsScored")}
            </span>
            <div className="section-title">{t("player.recentTrend")}</div>
          </div>
        </div>
        <div className="standings-card" style={{ padding: "8px 16px" }}>
          <div className="trend-chart">
            {trend.map(({ match, stats }) => (
              <div key={match.id} className={`trend-bar-wrap${match.won ? "" : " is-loss"}`}>
                <span className="trend-bar-value">{stats.points}</span>
                <div
                  className="trend-bar"
                  style={{ height: `${Math.max(6, (stats.points / maxPoints) * 100)}%` }}
                ></div>
                <span className="trend-bar-label">{match.opponent.abbreviation || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-regular fa-calendar"></i> {t("volleyballPlayer.matchLog")}
            </span>
          </div>
        </div>
        <div className="vb-table-wrap vb-box-wrap">
          <table className="vb-table vb-box-table vb-log-table">
            <thead>
              <tr>
                <th className="vb-th-player">{t("volleyballPlayer.match")}</th>
                <th>{t("volleyballPlayer.sets")}</th>
                {LOG_COLUMNS.map((key) => (
                  <th key={key} title={t(`modal.box.${boxLabel(key)}Title`)}>
                    {t(`modal.box.${boxLabel(key)}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {games.map(({ match, stats }) => (
                <tr key={match.id}>
                  <td className="vb-td-player">
                    <span className={`games-log-result ${match.won ? "win" : "loss"}`}>
                      {match.won ? "W" : "L"}
                    </span>{" "}
                    <span className="vb-player-name">
                      {match.home ? "vs" : "@"}{" "}
                      <TeamLink league={league} teamId={match.opponent.id}>
                        {match.opponent.displayName}
                      </TeamLink>
                    </span>{" "}
                    <span className="vb-player-sub">
                      {match.score[0]}-{match.score[1]} · {formatDate(match.date)}
                    </span>
                  </td>
                  <td>{stats.sets}</td>
                  {LOG_COLUMNS.map((key) => (
                    <td key={key} className={key === "points" ? "is-primary" : ""}>
                      {stats[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="vb-note">{t("volleyballPlayer.source", { count: progress.matches.length })}</p>
      </div>
    </div>
  );
}
