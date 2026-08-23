import { useEffect, useMemo, useState } from "react";
import { getAllPlayers, getStandings } from "../services/api";
import PlayerCard from "../components/PlayerCard";

const POSITIONS = [
  { value: "all", label: "Toutes" },
  { value: "Guard", label: "Arrières" },
  { value: "Forward", label: "Ailières" },
  { value: "Center", label: "Pivots" },
];

export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const [allPlayers, standings] = await Promise.all([getAllPlayers(), getStandings()]);
      setPlayers(allPlayers);
      setTeams(
        standings
          .flatMap((g) => g.entries.map((e) => e.team))
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      );
      setLoading(false);
    }
    load();
  }, []);

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
    <div className="container-wide">
      <div className="page-title">
        <span className="badge-icon">
          <i className="fa-solid fa-star"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Joueuses WNBA</h1>
      </div>
      <p className="page-subtitle">Recherche et explore les effectifs de toute la ligue.</p>

      <div className="filter-bar">
        <div className="search-field">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Rechercher une joueuse..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select
          className="select-field"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="all">Toutes les équipes</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
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
            {pos.label}
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
          <strong>Aucune joueuse trouvée</strong>
          <span>Essaie une autre recherche ou change de filtre.</span>
        </div>
      ) : (
        <>
          <div className="results-count">
            {filtered.length} joueuse{filtered.length > 1 ? "s" : ""}
          </div>
          <div className="player-grid">
            {filtered.map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
