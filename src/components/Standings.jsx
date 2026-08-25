import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStandings } from "../services/api";
import { getStat as stat } from "../utils/stats";

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

function StandingsTable({ entries, league }) {
  const { t } = useTranslation();
  return (
    <div className="standings-card">
      <div className="standings-header-row">
        <span>{t("standings.rank")}</span>
        <span>{t("standings.team")}</span>
        <span>{t("common.winAbbr")}</span>
        <span>{t("common.lossAbbr")}</span>
        <span className="standing-streak-head">{t("standings.streak")}</span>
        <span>{t("common.pctWinAbbr")}</span>
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

            <Link to={`/${league}/teams/${entry.team?.id}`} className="standing-team">
              <img src={entry.team?.logos?.[0]?.href} alt="" />
              <span>{entry.team?.displayName}</span>
            </Link>

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

export default function Standings({ league, limit, grouped }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    async function load() {
      const data = await getStandings(league);
      setGroups(data || []);
      setLoading(false);
    }
    load();
  }, [league]);

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
        <strong>{t("standings.unavailable")}</strong>
        <span>{t("common.retryLater")}</span>
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
            <StandingsTable entries={group.entries} league={league} />
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

  return <StandingsTable entries={limit ? sorted.slice(0, limit) : sorted} league={league} />;
}
