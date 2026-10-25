import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { requestSeason, useTeamSeason } from "../services/volleyballSeason";
import { buildRoster } from "../utils/volleyballBoxscore";

// The squad comes from the newest few matches...
const ROSTER_MATCHES = 5;
// ...and once it is on screen the rest of the season is read quietly in the
// background, so a player's page opens with their stats already waiting.
const PREFETCH_DELAY_MS = 1500;

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Volleyball squad as initials avatars: no photos exist for these players.
export default function VolleyballRoster({ league, teamId }) {
  const { t } = useTranslation();
  const season = useTeamSeason(league, teamId, ROSTER_MATCHES);
  const recent = useMemo(() => season.matches.slice(0, ROSTER_MATCHES), [season.matches]);
  const players = useMemo(() => buildRoster(recent), [recent]);

  const status = season.error
    ? "error"
    : !season.settled
      ? "loading"
      : players.length
        ? "ready"
        : "empty";
  const state = { status, players, matches: recent.length };

  useEffect(() => {
    if (status !== "ready" || navigator.connection?.saveData) return undefined;
    const timer = setTimeout(() => requestSeason(league, teamId), PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, league, teamId]);

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <span className="section-eyebrow">
            <i className="fa-solid fa-people-group"></i> {t("team.roster")}
          </span>
          <div className="section-title">
            {state.status === "ready"
              ? t("team.rosterCount", { count: state.players.length })
              : t("team.roster")}
          </div>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="player-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card"></div>
          ))}
        </div>
      ) : state.status !== "ready" ? (
        <div className="empty-state">
          <i className="fa-solid fa-person"></i>
          <strong>{t("team.rosterUnavailable")}</strong>
          <span>{t(state.status === "empty" ? "team.rosterNoMatches" : "common.retryLater")}</span>
        </div>
      ) : (
        <>
          <div className="player-grid">
            {state.players.map((p) => (
              <Link
                key={p.slug}
                to={`/${league}/teams/${teamId}/players/${p.slug}`}
                className="player-card"
              >
                <div className="player-photo-wrap player-initials" aria-hidden="true">
                  {initials(p.name)}
                </div>
                <div className="player-card-name">{p.name}</div>
                <div className="player-card-meta">
                  {p.position && <span className="position-badge">{p.position}</span>}
                  {p.number && <span>#{p.number}</span>}
                </div>
              </Link>
            ))}
          </div>
          <p className="vb-note">{t("team.rosterFromMatches", { count: state.matches })}</p>
        </>
      )}
    </div>
  );
}
