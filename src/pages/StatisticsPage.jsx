import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLeagueLeaders } from "../services/api";

const CATEGORIES = [
  { name: "pointsPerGame", label: "Points", short: "PPG", icon: "fa-solid fa-basketball" },
  { name: "reboundsPerGame", label: "Rebonds", short: "REB", icon: "fa-solid fa-hand-fist" },
  { name: "assistsPerGame", label: "Passes", short: "AST", icon: "fa-solid fa-people-arrows" },
  { name: "stealsPerGame", label: "Interceptions", short: "STL", icon: "fa-solid fa-hand" },
  { name: "blocksPerGame", label: "Contres", short: "BLK", icon: "fa-solid fa-shield-halved" },
  { name: "3PointsMadePerGame", label: "3 points", short: "3PM", icon: "fa-solid fa-bullseye" },
  { name: "fieldGoalPercentage", label: "% Tirs", short: "FG%", icon: "fa-solid fa-percent" },
  { name: "3PointPct", label: "% 3 pts", short: "3P%", icon: "fa-solid fa-percent" },
  { name: "FreeThrowPct", label: "% Lancers francs", short: "FT%", icon: "fa-solid fa-percent" },
];

function rankClass(index) {
  if (index === 0) return "rank-badge gold";
  if (index === 1) return "rank-badge silver";
  if (index === 2) return "rank-badge bronze";
  return "rank-badge";
}

function LeaderTeam({ team }) {
  if (!team) return null;
  const logo = team.logos?.[0]?.href;
  return (
    <span className="leader-team">
      {logo && <img src={logo} alt="" />}
      {team.abbreviation || team.displayName}
    </span>
  );
}

export default function StatisticsPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(CATEGORIES[0].name);

  useEffect(() => {
    async function load() {
      const data = await getLeagueLeaders();
      setCategories(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const byName = Object.fromEntries(categories.map((c) => [c.name, c]));
  const available = CATEGORIES.filter((c) => byName[c.name]?.leaders?.length);
  const activeMeta = CATEGORIES.find((c) => c.name === active);
  const leaders = byName[active]?.leaders || [];
  const [top, ...rest] = leaders;

  return (
    <div className="container-wide">
      <div className="page-title">
        <span className="badge-icon">
          <i className="fa-solid fa-chart-simple"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Statistiques</h1>
      </div>
      <p className="page-subtitle">Les meilleures performances de la ligue, catégorie par catégorie.</p>

      {loading ? (
        <div className="skeleton skeleton-card" style={{ height: 320 }}></div>
      ) : available.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-chart-simple"></i>
          <strong>Statistiques indisponibles</strong>
          <span>Réessaie un peu plus tard.</span>
        </div>
      ) : (
        <>
          <div className="chip-group" style={{ marginBottom: 22 }}>
            {available.map((c) => (
              <button
                key={c.name}
                className={`chip${active === c.name ? " active" : ""}`}
                onClick={() => setActive(c.name)}
              >
                <i className={c.icon}></i> {c.label}
              </button>
            ))}
          </div>

          {top && (
            <Link to={`/players/${top.athlete.id}`} className="leader-spotlight">
              <div className="leader-spotlight-glow"></div>
              <span className="rank-badge gold leader-spotlight-rank">1</span>

              <div className="leader-spotlight-photo">
                {top.athlete.headshot?.href ? (
                  <img src={top.athlete.headshot.href} alt="" />
                ) : (
                  <i className="fa-solid fa-person"></i>
                )}
              </div>

              <div className="leader-spotlight-info">
                <div className="leader-spotlight-name">{top.athlete.displayName}</div>
                <LeaderTeam team={top.team} />
              </div>

              <div className="leader-spotlight-stat">
                <div className="leader-spotlight-value">{top.displayValue}</div>
                <div className="leader-spotlight-label">{activeMeta?.short}</div>
              </div>
            </Link>
          )}

          <div className="leader-list">
            {rest.slice(0, 9).map((leader, i) => (
              <Link
                key={leader.athlete.id}
                to={`/players/${leader.athlete.id}`}
                className="leader-row"
              >
                <span className={rankClass(i + 1)}>{i + 2}</span>

                <div className="leader-photo">
                  {leader.athlete.headshot?.href ? (
                    <img src={leader.athlete.headshot.href} alt="" />
                  ) : (
                    <i className="fa-solid fa-person"></i>
                  )}
                </div>

                <div className="leader-info">
                  <div className="leader-name">{leader.athlete.displayName}</div>
                  <LeaderTeam team={leader.team} />
                </div>

                <div className="leader-value">{leader.displayValue}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
