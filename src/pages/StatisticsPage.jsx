import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getLeagueLeaders } from "../services/api";
import { getLeague } from "../leagues";

const CATEGORIES = [
  { name: "pointsPerGame", key: "statCategories.points", short: "PPG", icon: "fa-solid fa-basketball" },
  { name: "reboundsPerGame", key: "statCategories.rebounds", short: "REB", icon: "fa-solid fa-hand-fist" },
  { name: "assistsPerGame", key: "statCategories.assists", short: "AST", icon: "fa-solid fa-people-arrows" },
  { name: "stealsPerGame", key: "statCategories.steals", short: "STL", icon: "fa-solid fa-hand" },
  { name: "blocksPerGame", key: "statCategories.blocks", short: "BLK", icon: "fa-solid fa-shield-halved" },
  { name: "3PointsMadePerGame", key: "statCategories.threeMade", short: "3PM", icon: "fa-solid fa-bullseye" },
  { name: "fieldGoalPercentage", key: "statCategories.fgPct", short: "FG%", icon: "fa-solid fa-percent" },
  { name: "3PointPct", key: "statCategories.threePct", short: "3P%", icon: "fa-solid fa-percent" },
  { name: "FreeThrowPct", key: "statCategories.ftPct", short: "FT%", icon: "fa-solid fa-percent" },
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
  const { t } = useTranslation();
  const { league } = useParams();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(CATEGORIES[0].name);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    async function load() {
      const data = await getLeagueLeaders(league);
      setCategories(data || []);
      setLoading(false);
    }
    load();
  }, [league]);

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
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          {t("nav.stats")} {t(getLeague(league).labelKey)}
        </h1>
      </div>
      <p className="page-subtitle">{t("statistics.subtitle")}</p>

      {loading ? (
        <div className="skeleton skeleton-card" style={{ height: 320 }}></div>
      ) : available.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-chart-simple"></i>
          <strong>{t("statistics.unavailable")}</strong>
          <span>{t("common.retryLater")}</span>
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
                <i className={c.icon}></i> {t(c.key)}
              </button>
            ))}
          </div>

          {top && (
            <Link to={`/${league}/players/${top.athlete.id}`} className="leader-spotlight">
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
                to={`/${league}/players/${leader.athlete.id}`}
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
