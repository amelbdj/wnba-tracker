import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStandings } from "../services/api";
import TeamCard from "../components/TeamCard";
import { getLeague } from "../leagues";

export default function TeamsPage() {
  const { league } = useParams();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setQuery("");
    async function load() {
      const data = await getStandings(league);
      setGroups(data || []);
      setLoading(false);
    }
    load();
  }, [league]);

  const q = query.trim().toLowerCase();
  const filteredGroups = q
    ? groups
        .map((g) => ({
          ...g,
          entries: g.entries.filter((e) => e.team?.displayName?.toLowerCase().includes(q)),
        }))
        .filter((g) => g.entries.length > 0)
    : groups;

  return (
    <div className="container-wide">
      <div className="page-title">
        <span className="badge-icon">
          <i className="fa-solid fa-people-group"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Équipes {getLeague(league).label}</h1>
      </div>
      <p className="page-subtitle">Toutes les équipes de la ligue, par conférence.</p>

      {!loading && groups.length > 0 && (
        <div className="filter-bar">
          <div className="search-field">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Rechercher une équipe..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="team-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card"></div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-people-group"></i>
          <strong>Équipes indisponibles</strong>
          <span>Réessaie un peu plus tard.</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-magnifying-glass"></i>
          <strong>Aucune équipe trouvée</strong>
          <span>Essaie une autre recherche.</span>
        </div>
      ) : (
        filteredGroups.map((group) => (
          <div key={group.id} className="section">
            <div className="section-head">
              <div className="section-title">{group.name}</div>
            </div>
            <div className="team-grid">
              {group.entries.map((entry, i) => (
                <TeamCard
                  key={entry.team.id}
                  entry={entry}
                  conferenceAbbr={group.abbreviation}
                  index={i}
                  league={league}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
