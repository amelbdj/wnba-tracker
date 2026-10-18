import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStandings, getVolleyballLeaders } from "../services/api";
import { getLeague } from "../leagues";
import { buildTeamIndex, findTeam } from "../utils/ncaaTeams";
import { toLocale } from "../utils/locale";
import { playerSlug } from "../utils/volleyballBoxscore";
import {
  COLUMN_KEYS,
  IDENTITY_FIELDS,
  VOLLEYBALL_STAT_FAMILIES,
  parseThroughDate,
} from "../utils/volleyballStats";

// Loads one page of a leaderboard into `boards[statId]`, appending to what's
// already there. Kept outside the component so effects don't depend on it.
async function loadBoardPage(setBoards, statId, page) {
  setBoards((prev) => ({
    ...prev,
    [statId]: { ...(prev[statId] || { rows: [] }), loading: true, error: null },
  }));

  try {
    const data = await getVolleyballLeaders(statId, page);
    setBoards((prev) => {
      const current = prev[statId] || { rows: [] };
      return {
        ...prev,
        [statId]: {
          rows: page === 1 ? data.data : [...current.rows, ...data.data],
          page: data.page || page,
          pages: data.pages,
          updated: data.updated,
          loading: false,
          error: null,
        },
      };
    });
  } catch (err) {
    setBoards((prev) => ({
      ...prev,
      [statId]: { ...(prev[statId] || { rows: [] }), loading: false, error: err.message },
    }));
  }
}

function rankClass(rank) {
  if (rank === "1") return "rank-badge gold";
  if (rank === "2") return "rank-badge silver";
  if (rank === "3") return "rank-badge bronze";
  return "rank-badge";
}

function PlayerCell({ row, team, league }) {
  const teamName = team?.shortDisplayName || row.Team;
  const details = [teamName, row.Position, row.Cl].filter(Boolean).join(" · ");
  const logo = team?.logos?.[0]?.href;

  const content = (
    <>
      {logo ? <img src={logo} alt="" /> : <span className="vb-player-logo-fallback"></span>}
      <span className="vb-player-text">
        <span className="vb-player-name">{row.Name}</span>
        <span className="vb-player-sub">{details}</span>
      </span>
    </>
  );

  return team ? (
    <Link to={`/${league}/teams/${team.id}/players/${playerSlug(row.Name)}`} className="vb-player">
      {content}
    </Link>
  ) : (
    <div className="vb-player">{content}</div>
  );
}

export default function VolleyballStatistics({ league }) {
  const { t, i18n } = useTranslation();
  const [familyKey, setFamilyKey] = useState(VOLLEYBALL_STAT_FAMILIES[0].key);
  const [mode, setMode] = useState("perSet");
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState({}); // statId -> { rows, page, pages, updated, loading, error }
  const [teamIndex, setTeamIndex] = useState(null);

  const family = VOLLEYBALL_STAT_FAMILIES.find((f) => f.key === familyKey);
  const stat = family[mode] || family.perSet || family.total;
  const activeMode = stat === family.perSet ? "perSet" : "total";
  const board = boards[stat.id];
  const searching = query.trim().length > 0;

  // NCAA.com has no team ids: ESPN's teams (from the standings) are what lets
  // a row show a logo and link to the team page.
  useEffect(() => {
    let cancelled = false;
    getStandings(league)
      .then((groups) => {
        if (!cancelled) setTeamIndex(buildTeamIndex(groups.flatMap((g) => g.entries.map((e) => e.team))));
      })
      .catch(() => {
        if (!cancelled) setTeamIndex(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [league]);

  // First page of whichever leaderboard is selected (cached once loaded).
  useEffect(() => {
    if (!board) loadBoardPage(setBoards, stat.id, 1);
  }, [stat.id, board]);

  // While searching, quietly pull in the remaining pages so the search covers
  // every player on the leaderboard, not just the 50 that happen to be loaded.
  useEffect(() => {
    if (searching && board && !board.loading && !board.error && board.page < board.pages) {
      loadBoardPage(setBoards, stat.id, board.page + 1);
    }
  }, [searching, board, stat.id]);

  const q = query.trim().toLowerCase();
  const rows = (board?.rows || []).filter(
    (r) => !q || r.Name?.toLowerCase().includes(q) || r.Team?.toLowerCase().includes(q),
  );
  const statColumns = Object.keys(board?.rows?.[0] || {}).filter((k) => !IDENTITY_FIELDS.has(k));
  const hasMore = board && board.page < board.pages;
  const throughDate = parseThroughDate(board?.updated);
  const columnLabel = (key) =>
    COLUMN_KEYS[key] ? t(`volleyballStats.col.${COLUMN_KEYS[key]}`) : key;

  return (
    <div className="container-wide">
      <div className="page-title">
        <span className="badge-icon">
          <i className="fa-solid fa-chart-simple"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          {t("nav.stats")} {t(getLeague(league).labelKey)}
        </h1>
      </div>
      <p className="page-subtitle">{t("volleyballStats.subtitle")}</p>

      <div className="chip-group" style={{ marginBottom: 18 }}>
        {VOLLEYBALL_STAT_FAMILIES.map((f) => (
          <button
            key={f.key}
            className={`chip${f.key === familyKey ? " active" : ""}`}
            onClick={() => setFamilyKey(f.key)}
          >
            <i className={f.icon}></i> {t(`volleyballStats.family.${f.key}`)}
          </button>
        ))}
      </div>

      <div className="vb-controls">
        {family.perSet && family.total && (
          <div className="segmented" role="group" aria-label={t("volleyballStats.mode")}>
            <button
              className={`segmented-btn${activeMode === "perSet" ? " active" : ""}`}
              onClick={() => setMode("perSet")}
            >
              {t("volleyballStats.modePerSet")}
            </button>
            <button
              className={`segmented-btn${activeMode === "total" ? " active" : ""}`}
              onClick={() => setMode("total")}
            >
              {t("volleyballStats.modeTotal")}
            </button>
          </div>
        )}

        <div className="search-field vb-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder={t("volleyballStats.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {board?.error && board.rows.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-chart-simple"></i>
          <strong>{t("volleyballStats.unavailable")}</strong>
          <span>{t("common.retryLater")}</span>
          <button className="btn btn-ghost" onClick={() => loadBoardPage(setBoards, stat.id, 1)}>
            {t("volleyballStats.retry")}
          </button>
        </div>
      ) : !board || (board.loading && board.rows.length === 0) ? (
        <div className="skeleton skeleton-card" style={{ height: 420 }}></div>
      ) : rows.length === 0 && !hasMore ? (
        <div className="empty-state">
          <i className="fa-solid fa-magnifying-glass"></i>
          <strong>{t("volleyballStats.noResults")}</strong>
          <span>{t("common.tryAnotherSearch")}</span>
        </div>
      ) : (
        <>
          <div className="vb-table-wrap">
            <table className="vb-table">
              <thead>
                <tr>
                  <th className="vb-th-rank">#</th>
                  <th className="vb-th-player">{t("volleyballStats.player")}</th>
                  {statColumns.map((key) => (
                    <th key={key} className={key === stat.primary ? "is-primary" : ""}>
                      {columnLabel(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.Rank}-${row.Name}-${row.Team}`}>
                    <td className="vb-rank">
                      <span className={rankClass(row.Rank)}>{row.Rank}</span>
                    </td>
                    <td className="vb-td-player">
                      <PlayerCell
                        row={row}
                        team={teamIndex ? findTeam(teamIndex, row.Team) : null}
                        league={league}
                      />
                    </td>
                    {statColumns.map((key) => (
                      <td key={key} className={key === stat.primary ? "is-primary" : ""}>
                        {row[key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {searching && hasMore && (
            <p className="vb-note">
              <span className="tiktok-spinner"></span> {t("volleyballStats.searchingAll")}
            </p>
          )}

          {!searching && hasMore && (
            <div className="vb-more">
              <button
                className="btn btn-ghost"
                disabled={board.loading}
                onClick={() => loadBoardPage(setBoards, stat.id, board.page + 1)}
              >
                {board.loading ? t("volleyballStats.loading") : t("volleyballStats.loadMore")}
              </button>
            </div>
          )}

          {board.error && <p className="vb-note vb-note-error">{t("volleyballStats.partialError")}</p>}

          <p className="vb-note">
            {throughDate &&
              `${t("volleyballStats.through", {
                date: throughDate.toLocaleDateString(toLocale(i18n.language), {
                  day: "numeric",
                  month: "long",
                }),
              })} · `}
            {t("volleyballStats.source")}
          </p>
        </>
      )}
    </div>
  );
}
