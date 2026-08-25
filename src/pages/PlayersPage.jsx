import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getAllPlayers, getStandings, searchPlayers } from "../services/api";
import PlayerCard from "../components/PlayerCard";
import { getLeague } from "../leagues";

const POSITIONS = [
  { value: "all", key: "positions.all" },
  { value: "Guard", key: "positions.guard" },
  { value: "Forward", key: "positions.forward" },
  { value: "Center", key: "positions.center" },
];

function AggregatePlayers({ league }) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    async function load() {
      const [allPlayers, standings] = await Promise.all([
        getAllPlayers(league),
        getStandings(league),
      ]);
      setPlayers(allPlayers);
      setTeams(
        standings
          .flatMap((g) => g.entries.map((e) => e.team))
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      );
      setLoading(false);
    }
    load();
  }, [league]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      const name = (p.displayName || p.fullName || "").toLowerCase();
      const matchesQuery = !q || name.includes(q);
      const matchesTeam = teamFilter === "all" || p.team?.id === teamFilter;
      const matchesPosition = positionFilter === "all" || p.position?.name === positionFilter;
      return matchesQuery && matchesTeam && matchesPosition;
    });
  }, [players, query, teamFilter, positionFilter]);

  return (
    <>
      <div className="filter-bar">
        <div className="search-field">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder={t("players.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select
          className="select-field"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="all">{t("common.allTeams")}</option>
          {teams.map((t2) => (
            <option key={t2.id} value={t2.id}>
              {t2.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="chip-group" style={{ marginBottom: 22 }}>
        {POSITIONS.map((pos) => (
          <button
            key={pos.value}
            className={`chip${positionFilter === pos.value ? " active" : ""}`}
            onClick={() => setPositionFilter(pos.value)}
          >
            {t(pos.key)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="player-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-magnifying-glass"></i>
          <strong>{t("players.noResults")}</strong>
          <span>{t("players.tryOtherFilter")}</span>
        </div>
      ) : (
        <>
          <div className="results-count">{t("players.resultsCount", { count: filtered.length })}</div>
          <div className="player-grid">
            {filtered.map((p) => (
              <PlayerCard key={p.id} player={p} league={league} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function SearchPlayers({ league }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      const found = await searchPlayers(league, q);
      setResults(found);
      setSearching(false);
      setSearched(true);
    }, 300);

    return () => clearTimeout(timeout);
  }, [league, query]);

  return (
    <>
      <div className="filter-bar">
        <div className="search-field">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder={t("players.searchPlaceholderLarge")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {query.trim().length < 2 ? (
        <div className="empty-state">
          <i className="fa-solid fa-magnifying-glass"></i>
          <strong>{t("players.searchPromptTitle")}</strong>
          <span>
            {t("players.searchPromptSubtitle", { league: t(getLeague(league).labelKey) })}
          </span>
        </div>
      ) : searching ? (
        <div className="player-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card"></div>
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-magnifying-glass"></i>
          <strong>{t("players.noResults")}</strong>
          <span>{t("players.noResultsSubtitle")}</span>
        </div>
      ) : (
        <>
          <div className="results-count">
            {t("players.searchResultsCount", { count: results.length })}
          </div>
          <div className="player-grid">
            {results.map((p) => (
              <PlayerCard key={p.id} player={p} league={league} showTeam={!!p.team} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function PlayersPage() {
  const { t } = useTranslation();
  const { league } = useParams();
  const mode = getLeague(league).playersMode;

  return (
    <div className="container-wide">
      <div className="page-title">
        <span className="badge-icon">
          <i className="fa-solid fa-star"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          {t("nav.players")} {t(getLeague(league).labelKey)}
        </h1>
      </div>
      <p className="page-subtitle">{t("players.subtitle")}</p>

      {mode === "search" ? <SearchPlayers league={league} /> : <AggregatePlayers league={league} />}
    </div>
  );
}
