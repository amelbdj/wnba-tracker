import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getTeamDetails, getTeamRoster } from "../services/api";
import PlayerCard from "../components/PlayerCard";

function findStat(items, description, name) {
  const group = items?.find((i) => i.description === description);
  return group?.stats?.find((s) => s.name === name);
}

export default function TeamDetailPage() {
  const { t } = useTranslation();
  const { league, teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    async function load() {
      const [teamData, rosterData] = await Promise.all([
        getTeamDetails(league, teamId),
        getTeamRoster(league, teamId),
      ]);
      setTeam(teamData);
      setRoster(rosterData);
      setLoading(false);
    }
    load();
  }, [league, teamId]);

  if (loading) {
    return (
      <div className="container-wide">
        <div className="skeleton skeleton-card" style={{ height: 220 }}></div>
        <div className="section">
          <div className="player-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-card"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container-wide">
        <div className="empty-state">
          <i className="fa-solid fa-people-group"></i>
          <strong>{t("team.notFound")}</strong>
          <span>{t("team.notFoundSubtitle")}</span>
        </div>
      </div>
    );
  }

  const items = team.record?.items;
  const wins = findStat(items, "Overall Record", "wins")?.value ?? 0;
  const losses = findStat(items, "Overall Record", "losses")?.value ?? 0;
  const streakValue = findStat(items, "Overall Record", "streak")?.value;
  const streak = streakValue ? `${streakValue > 0 ? "W" : "L"}${Math.abs(streakValue)}` : null;
  const pointsForValue = findStat(items, "Overall Record", "avgPointsFor")?.value;
  const pointsAgainstValue = findStat(items, "Overall Record", "avgPointsAgainst")?.value;
  const diffValue = findStat(items, "Overall Record", "differential")?.value;
  const pointsFor = pointsForValue != null ? pointsForValue.toFixed(1) : null;
  const pointsAgainst = pointsAgainstValue != null ? pointsAgainstValue.toFixed(1) : null;
  const diff = diffValue != null ? `${diffValue >= 0 ? "+" : ""}${diffValue.toFixed(1)}` : null;

  const nextEvent = team.nextEvent?.[0];
  const nextComp = nextEvent?.competitions?.[0];

  return (
    <div className="container-wide">
      <Link to={`/${league}/teams`} className="nav-btn">
        <i className="fa-solid fa-arrow-left"></i> {t("common.allTeams")}
      </Link>

      <section className="hero team-hero" style={{ marginTop: 20 }}>
        <div
          className="team-hero-glow"
          style={{
            background: `radial-gradient(60% 80% at 15% 20%, ${
              team.color ? `#${team.color}55` : "rgba(79,70,229,0.35)"
            } 0%, transparent 70%)`,
          }}
        ></div>

        <div className="hero-inner">
          <div className="team-hero-top">
            <img src={team.logos?.[0]?.href} alt="" className="team-hero-logo" />
            <div>
              <div className="team-hero-name">{team.displayName}</div>
              <div className="team-hero-sub">
                {team.standingSummary || `${wins}-${losses}`}
                {streak && (
                  <span className={`streak-pill ${streak.startsWith("W") ? "win" : "loss"}`} style={{ marginLeft: 10 }}>
                    {streak}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="team-hero-stats">
            <div className="stat-tile">
              <div className="stat-tile-value">{wins}</div>
              <div className="stat-tile-label">{t("common.wins")}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-value">{losses}</div>
              <div className="stat-tile-label">{t("common.losses")}</div>
            </div>
            {pointsFor && (
              <div className="stat-tile">
                <div className="stat-tile-value">{pointsFor}</div>
                <div className="stat-tile-label">{t("team.pointsPerGame")}</div>
              </div>
            )}
            {pointsAgainst && (
              <div className="stat-tile">
                <div className="stat-tile-value">{pointsAgainst}</div>
                <div className="stat-tile-label">{t("team.pointsAgainst")}</div>
              </div>
            )}
            {diff && (
              <div className="stat-tile">
                <div className="stat-tile-value">{diff}</div>
                <div className="stat-tile-label">{t("team.differential")}</div>
              </div>
            )}
          </div>

          {nextComp && (
            <div className="team-next-game">
              <i className="fa-regular fa-calendar"></i>
              {t("team.nextGame")}
              {nextComp.competitors?.map((c) => (
                <strong key={c.homeAway}>{c.team?.abbreviation || c.team?.displayName}</strong>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="section">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">
              <i className="fa-solid fa-people-group"></i> {t("team.roster")}
            </span>
            <div className="section-title">{t("team.rosterCount", { count: roster.length })}</div>
          </div>
        </div>

        {roster.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-person"></i>
            <strong>{t("team.rosterUnavailable")}</strong>
            <span>{t("common.retryLater")}</span>
          </div>
        ) : (
          <div className="player-grid">
            {roster.map((player) => (
              <PlayerCard key={player.id} player={player} league={league} showTeam={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
