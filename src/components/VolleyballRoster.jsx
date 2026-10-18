import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getVolleyballRoster } from "../services/api";

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Volleyball squad as initials avatars: no photos exist for these players.
export default function VolleyballRoster({ league, teamId }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getVolleyballRoster(league, teamId)
      .then((roster) => {
        if (!cancelled) setState({ status: roster.players.length ? "ready" : "empty", ...roster });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [league, teamId]);

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
