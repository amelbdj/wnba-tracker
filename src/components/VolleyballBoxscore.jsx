import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVolleyballBoxscore } from "../services/api";

const LIVE_REFRESH_MS = 20 * 1000;

const COLUMNS = [
  { key: "points", label: "pts" },
  { key: "kills", label: "kills" },
  { key: "errors", label: "errors" },
  { key: "attempts", label: "attempts" },
  { key: "pct", label: "pct" },
  { key: "assists", label: "assists" },
  { key: "aces", label: "aces" },
  { key: "digs", label: "digs" },
  { key: "blocks", label: "blocks" },
];

// Per-player stats for a volleyball match, from NCAA.com. Loads once, then
// keeps refreshing while the match is live (and the tab is visible).
export default function VolleyballBoxscore({ competition, live }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ status: "loading", box: null });
  const [side, setSide] = useState(0);
  const upcoming = competition.status?.type?.state === "pre";

  useEffect(() => {
    if (upcoming) return undefined;
    let cancelled = false;
    let timer = null;

    async function load() {
      if (document.hidden) {
        timer = setTimeout(load, LIVE_REFRESH_MS);
        return;
      }
      try {
        const box = await getVolleyballBoxscore(competition);
        if (cancelled) return;
        setState({ status: box ? "ready" : "missing", box });
        if (live && box) timer = setTimeout(load, LIVE_REFRESH_MS);
      } catch {
        if (cancelled) return;
        // Keep any stats already on screen; otherwise report the failure.
        setState((prev) => (prev.box ? prev : { status: "error", box: null }));
        if (live) timer = setTimeout(load, LIVE_REFRESH_MS);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // The match identity and live flag are what matter; ESPN returns a fresh
    // `competition` object on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id, competition.date, live, upcoming]);

  if (upcoming) return null;

  const teams = competition.competitors.map((c) => c.team);

  const body = () => {
    if (state.status === "loading") {
      return <div className="skeleton skeleton-card" style={{ height: 220 }}></div>;
    }
    if (state.status !== "ready") {
      return (
        <p className="vb-note">
          {t(state.status === "missing" ? "modal.playerStatsMissing" : "modal.playerStatsError")}
        </p>
      );
    }

    const { players, totals } = state.box.teams[side];
    if (players.length === 0) {
      return <p className="vb-note">{t("modal.playerStatsPending")}</p>;
    }

    return (
      <div className="vb-table-wrap vb-box-wrap">
        <table className="vb-table vb-box-table">
          <thead>
            <tr>
              <th className="vb-th-rank">#</th>
              <th className="vb-th-player">{t("volleyballStats.player")}</th>
              {COLUMNS.map((c) => (
                <th key={c.key} title={t(`modal.box.${c.label}Title`)}>
                  {t(`modal.box.${c.label}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={`${p.number}-${p.name}`}>
                <td className="vb-rank">{p.number}</td>
                <td className="vb-td-player">
                  <span className="vb-player-name">{p.name}</span>
                  {p.position && <span className="vb-player-sub"> {p.position}</span>}
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={c.key === "points" ? "is-primary" : ""}>
                    {p[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="vb-box-total">
              <td></td>
              <td className="vb-td-player">{t("modal.box.total")}</td>
              {COLUMNS.map((c) => (
                <td key={c.key}>{totals[c.key]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="vb-box">
      <div className="modal-subtitle">{t("modal.playerStats")}</div>
      <div className="chip-group" style={{ marginBottom: 12 }}>
        {teams.map((team, i) => (
          <button
            key={team.id}
            className={`chip${i === side ? " active" : ""}`}
            onClick={() => setSide(i)}
          >
            {team.abbreviation || team.displayName}
          </button>
        ))}
      </div>
      {body()}
      {state.status === "ready" && <p className="vb-note">{t("modal.playerStatsSource")}</p>}
    </div>
  );
}
