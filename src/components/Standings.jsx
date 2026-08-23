import { useEffect, useState } from "react";
import { getStandings } from "../services/api";

function stat(entry, name) {
  return entry.stats?.find((s) => s.name === name);
}

function rankClass(index) {
  if (index === 0) return "rank-badge gold";
  if (index === 1) return "rank-badge silver";
  if (index === 2) return "rank-badge bronze";
  return "rank-badge";
}

function StreakPill({ displayValue }) {
  if (!displayValue) return <span className="standing-streak">—</span>;
  const isWin = displayValue.startsWith("W");
  return (
    <span className={`streak-pill ${isWin ? "win" : "loss"}`}>{displayValue}</span>
  );
}

function StandingsTable({ entries }) {
  return (
    <div className="standings-card">
      <div className="standings-header-row">
        <span>#</span>
        <span>Équipe</span>
        <span>V</span>
        <span>D</span>
        <span className="standing-streak-head">Série</span>
        <span>%V</span>
      </div>

      {entries.map((entry, index) => {
        const wins = stat(entry, "wins")?.value ?? 0;
        const losses = stat(entry, "losses")?.value ?? 0;
        const winPercentStat = stat(entry, "winPercent");
        const pct =
          winPercentStat?.value != null
            ? winPercentStat.value * 100
            : wins + losses > 0
              ? (wins / (wins + losses)) * 100
              : 0;
        const streak = stat(entry, "streak")?.displayValue;

        return (
          <div key={entry.team?.id || index} className="standing-row">
            <span className={rankClass(index)}>{index + 1}</span>

            <div className="standing-team">
              <img src={entry.team?.logos?.[0]?.href} alt="" />
              <span>{entry.team?.displayName}</span>
            </div>

            <span className="standing-w">{wins}</span>
            <span className="standing-l">{losses}</span>

            <span className="standing-streak">
              <StreakPill displayValue={streak} />
            </span>

            <div className="standing-pct">
              <div className="standing-pct-track">
                <div className="standing-pct-fill" style={{ width: `${pct}%` }}></div>
              </div>
              <span className="standing-pct-label">{pct.toFixed(0)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Standings({ limit, grouped }) {
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

  if (loading) {
    return (
      <div className="standings-card">
        <div style={{ padding: 14 }}>
          {Array.from({ length: limit || 5 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-row"></div>
          ))}
        </div>
      </div>
    );
  }

  const allEntries = groups.flatMap((g) => g.entries);

  if (allEntries.length === 0) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-ranking-star"></i>
        <strong>Classement indisponible</strong>
        <span>Réessaie un peu plus tard.</span>
      </div>
    );
  }

  if (grouped) {
    return (
      <div className="standings-groups">
        {groups.map((group) => (
          <div key={group.id} className="section">
            <div className="section-head">
              <div className="section-title standings-group-title">{group.name}</div>
            </div>
            <StandingsTable entries={group.entries} />
          </div>
        ))}
      </div>
    );
  }

  const sorted = [...allEntries].sort((a, b) => {
    const pa = stat(a, "winPercent")?.value ?? 0;
    const pb = stat(b, "winPercent")?.value ?? 0;
    return pb - pa;
  });

  return <StandingsTable entries={limit ? sorted.slice(0, limit) : sorted} />;
}
