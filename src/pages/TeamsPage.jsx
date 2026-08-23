import { useEffect, useState } from "react";
import { getStandings } from "../services/api";
import TeamCard from "../components/TeamCard";

export default function TeamsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getStandings();
      setGroups(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="container-wide">
      <div className="page-title">
        <span className="badge-icon">
          <i className="fa-solid fa-people-group"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Équipes WNBA</h1>
      </div>
      <p className="page-subtitle">Toutes les équipes de la ligue, par conférence.</p>

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
      ) : (
        groups.map((group) => (
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
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
