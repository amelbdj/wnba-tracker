import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPlayerGameLog, getPlayerOverview, getPlayerProfile } from "../services/api";
import { buildSoccerRecent, buildSoccerStats } from "../utils/soccerPlayer";
import { toLocale } from "../utils/locale";
import { getLeague, getSport } from "../leagues";
import { translatePosition } from "../utils/positions";
import TeamLink from "../components/TeamLink";

function parseRecentGames(gamelog, limit = 8) {
  if (!gamelog?.seasonTypes?.length) return { games: [], ptsIndex: -1 };

  const ptsIndex = gamelog.labels ? gamelog.labels.indexOf("PTS") : -1;

  const regular =
    gamelog.seasonTypes.find((st) => st.displayName?.toLowerCase().includes("regular")) ||
    gamelog.seasonTypes[0];

  const events = (regular.categories || []).flatMap((c) => c.events || []);

  const games = events
    .map((e) => ({ ...e, meta: gamelog.events?.[e.eventId] }))
    .filter((e) => e.meta)
    .sort((a, b) => new Date(b.meta.gameDate) - new Date(a.meta.gameDate))
    .slice(0, limit);

  return { games, ptsIndex };
}

// What a player did in one match, as words ("1 but · 2 passes décisives"), or
// a dash for a match without a notable number.
function soccerMatchLine(game, t) {
  const parts = [
    game.goals && t("soccerPlayer.goals", { count: game.goals }),
    game.assists && t("soccerPlayer.assists", { count: game.assists }),
    game.saves && t("soccerPlayer.saves", { count: game.saves }),
    game.yellow && t("soccerPlayer.yellow", { count: game.yellow }),
    game.red && t("soccerPlayer.red", { count: game.red }),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default function PlayerProfilePage() {
  const { t, i18n } = useTranslation();
  const { league, playerId } = useParams();
  const [player, setPlayer] = useState(null);
  const [gamelog, setGamelog] = useState(null);
  const [soccer, setSoccer] = useState(null); // football: { stats, recent }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    async function load() {
      if (getSport(league) === "soccer") {
        // Football has its own numbers (see utils/soccerPlayer), and no
        // points-per-game log.
        const [profile, overview] = await Promise.all([
          getPlayerProfile(league, playerId),
          getPlayerOverview(league, playerId).catch(() => null),
        ]);
        setPlayer(profile);
        setGamelog(null);
        setSoccer({ stats: buildSoccerStats(overview, league), recent: buildSoccerRecent(overview) });
        setLoading(false);
        return;
      }

      const [profile, log] = await Promise.all([
        getPlayerProfile(league, playerId),
        getPlayerGameLog(league, playerId),
      ]);
      setPlayer(profile);
      setGamelog(log);
      setSoccer(null);
      setLoading(false);
    }
    load();
  }, [league, playerId]);

  if (loading) {
    return (
      <div className="container">
        <div className="skeleton skeleton-card" style={{ height: 220 }}></div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="container">
        <div className="empty-state">
          <i className="fa-solid fa-person"></i>
          <strong>{t("player.notFound")}</strong>
          <span>{t("player.notFoundSubtitle")}</span>
        </div>
      </div>
    );
  }

  const { games, ptsIndex } = parseRecentGames(gamelog);
  const trendGames = [...games].reverse();
  const maxPts = Math.max(1, ...trendGames.map((g) => Number(g.stats?.[ptsIndex]) || 0));
  const teamLogo = player.team?.logos?.[0]?.href;
  const locale = toLocale(i18n.language);

  // The season tiles: football's totals for this league, or ESPN's summary.
  const tiles = soccer
    ? (soccer.stats?.tiles || []).map((tile) => ({
        key: tile.name,
        label: t(`soccerPlayer.stat.${tile.name}`),
        value: tile.value,
      }))
    : (player.statsSummary?.statistics || []).map((stat) => ({
        key: stat.name,
        label: stat.shortDisplayName || stat.abbreviation,
        value: stat.displayValue,
      }));
  const tilesTitle = soccer
    ? soccer.stats?.title
    : player.statsSummary?.displayName || t("player.seasonStatsFallback");

  return (
    <div className="container">
      <Link to={`/${league}/players`} className="nav-btn">
        <i className="fa-solid fa-arrow-left"></i> {t("common.allPlayers")}
      </Link>

      <section className="hero profile-hero" style={{ marginTop: 20 }}>
        <div className="hero-inner profile-hero-inner">
          <div className="profile-photo-wrap">
            {player.headshot?.href ? (
              <img src={player.headshot.href} alt="" />
            ) : (
              <i className="fa-solid fa-person"></i>
            )}
            {player.displayJersey && <span className="profile-jersey">{player.displayJersey}</span>}
          </div>

          <div className="profile-info">
            {player.position?.displayName && (
              <span className="hero-tag">{translatePosition(player.position.displayName, t)}</span>
            )}
            <h1 className="hero-headline" style={{ marginTop: 12, marginBottom: 0 }}>
              {player.displayName}
            </h1>

            <div className="profile-meta-row">
              {player.team && (
                <TeamLink league={league} teamId={player.team.id}>
                  {teamLogo && <img src={teamLogo} alt="" />}
                  {player.team.displayName}
                </TeamLink>
              )}
              {player.displayHeight && (
                <span>
                  <i className="fa-solid fa-ruler-vertical"></i> {player.displayHeight}
                </span>
              )}
              {player.age && (
                <span>
                  <i className="fa-regular fa-calendar"></i> {t("player.age", { count: player.age })}
                </span>
              )}
              {player.displayBirthPlace && (
                <span>
                  <i className="fa-solid fa-location-dot"></i> {player.displayBirthPlace}
                </span>
              )}
              {player.displayExperience && (
                <span>
                  <i className={getLeague(league).icon}></i> {player.displayExperience}
                </span>
              )}
            </div>

            {player.team && (
              <Link to={`/${league}/teams/${player.team.id}`} className="btn btn-ghost">
                <i className="fa-solid fa-people-group"></i> {t("common.viewTeam")}
              </Link>
            )}
          </div>
        </div>
      </section>

      {tiles.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div>
              <span className="section-eyebrow">
                <i className="fa-solid fa-chart-simple"></i> {tilesTitle}
              </span>
            </div>
          </div>

          <div className="stat-tiles">
            {tiles.map((tile) => (
              <div key={tile.key} className="stat-tile">
                <div className="stat-tile-value">{tile.value}</div>
                <div className="stat-tile-label">{tile.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* "points scored per game" is a basketball chart; ESPN has no game log for football */}
      {getSport(league) !== "soccer" && (
      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-chart-line"></i> {t("player.pointsScored")}
            </span>
            <div className="section-title">{t("player.recentTrend")}</div>
          </div>
        </div>

        {trendGames.length === 0 || ptsIndex === -1 ? (
          <div className="empty-state">
            <i className="fa-solid fa-chart-line"></i>
            <strong>{t("player.noRecentGames")}</strong>
            <span>{t("player.noPerformanceData")}</span>
          </div>
        ) : (
          <div className="standings-card" style={{ padding: "8px 16px" }}>
            <div className="trend-chart">
              {trendGames.map((g) => {
                const pts = Number(g.stats?.[ptsIndex]) || 0;
                const height = Math.max(6, (pts / maxPts) * 100);
                const isLoss = g.meta.gameResult === "L";
                return (
                  <div key={g.eventId} className={`trend-bar-wrap${isLoss ? " is-loss" : ""}`}>
                    <span className="trend-bar-value">{pts}</span>
                    <div className="trend-bar" style={{ height: `${height}%` }}></div>
                    <span className="trend-bar-label">
                      {g.meta.opponent?.abbreviation || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {soccer && soccer.recent.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div>
              <span className="section-eyebrow">
                <i className="fa-regular fa-calendar"></i> {t("player.recentGames")}
              </span>
            </div>
          </div>

          <div className="games-log">
            {soccer.recent.map((g) => (
              <div key={g.id} className="games-log-row">
                <span className={`games-log-result ${{ W: "win", D: "draw", L: "loss" }[g.result] || "draw"}`}>
                  {g.result}
                </span>
                {/* not a link: the log spans competitions, e.g. a national-team friendly,
                    and that opponent has no page in this league */}
                <span className="games-log-opponent">
                  {g.atVs} {g.opponent.displayName}
                </span>
                <span className="games-log-date">
                  {new Date(g.date).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                </span>
                <span className="games-log-pts soccer-log-line">{soccerMatchLine(g, t)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {games.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div>
              <span className="section-eyebrow">
                <i className="fa-regular fa-calendar"></i> {t("player.recentGames")}
              </span>
            </div>
          </div>

          <div className="games-log">
            {games.map((g) => {
              const pts = ptsIndex !== -1 ? g.stats?.[ptsIndex] : "—";
              const isWin = g.meta.gameResult === "W";
              const date = new Date(g.meta.gameDate).toLocaleDateString(locale, {
                day: "2-digit",
                month: "short",
              });
              return (
                <div key={g.eventId} className="games-log-row">
                  <span className={`games-log-result ${isWin ? "win" : "loss"}`}>
                    {g.meta.gameResult}
                  </span>
                  <span className="games-log-opponent">
                    {g.meta.atVs}{" "}
                    <TeamLink league={league} teamId={g.meta.opponent?.id}>
                      {g.meta.opponent?.displayName}
                    </TeamLink>
                  </span>
                  <span className="games-log-date">{date}</span>
                  <span className="games-log-pts">{t("player.pts", { count: pts })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
