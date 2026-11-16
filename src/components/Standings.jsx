import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStandings } from "../services/api";
import { getStat as stat } from "../utils/stats";
import { getLeague, getSport } from "../leagues";

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

// ESPN's wording for the coloured zones of a football table (qualification,
  // relegation…), as keys we can translate. Anything unknown keeps ESPN's text.
const ZONE_KEYS = {
  "champions league": "championsLeague",
  "champions league group stage": "championsLeagueGroup",
  "champions league qualifying": "championsLeagueQualifying",
  relegation: "relegation",
  "relegation playoff": "relegationPlayoff",
  "qualifies for round of 16": "roundOf16",
  "qualifies for playoffs": "playoffs",
  "qualifies for playoffs + concacaf w champions cup": "playoffsConcacaf",
  "nwsl shield; qualifies for playoffs + concacaf w champions cup": "shieldPlayoffsConcacaf",
};

// Football: points table — played, won, drawn, lost, goal difference, points —
// with the zone colour (Champions League, relegation…) on the rank badge.
function SoccerTable({ entries, league, showLegend }) {
  const { t } = useTranslation();
  const col = (entry, name) => stat(entry, name)?.displayValue ?? "–";

  const zones = [];
  for (const entry of entries) {
    const note = entry.note;
    if (note?.description && !zones.some((z) => z.description === note.description)) zones.push(note);
  }
  const zoneLabel = (description) =>
    t(`standingsSoccer.zones.${ZONE_KEYS[description.toLowerCase()]}`, { defaultValue: description });

  return (
    <>
      <div className="standings-card">
        <div className="standings-header-row soccer">
          <span>{t("standings.rank")}</span>
          <span>{t("standings.team")}</span>
          <span>{t("standingsSoccer.played")}</span>
          <span>{t("standingsSoccer.won")}</span>
          <span>{t("standingsSoccer.drawn")}</span>
          <span>{t("standingsSoccer.lost")}</span>
          <span className="soccer-diff">{t("standingsSoccer.goalDiff")}</span>
          <span>{t("standingsSoccer.points")}</span>
        </div>

        {entries.map((entry, index) => (
          <div key={entry.team?.id || index} className="standing-row soccer">
            <span
              className="rank-badge zone"
              style={entry.note?.color ? { "--zone": entry.note.color } : undefined}
              title={entry.note?.description ? zoneLabel(entry.note.description) : undefined}
            >
              {col(entry, "rank") !== "–" ? col(entry, "rank") : index + 1}
            </span>

            <Link to={`/${league}/teams/${entry.team?.id}`} className="standing-team">
              <img src={entry.team?.logos?.[0]?.href} alt="" />
              <span>{entry.team?.displayName}</span>
            </Link>

            <span className="standing-num">{col(entry, "gamesPlayed")}</span>
            <span className="standing-num standing-w">{col(entry, "wins")}</span>
            <span className="standing-num">{col(entry, "ties")}</span>
            <span className="standing-num standing-l">{col(entry, "losses")}</span>
            <span className="standing-num soccer-diff">{col(entry, "pointDifferential")}</span>
            <span className="standing-num standing-pts">{col(entry, "points")}</span>
          </div>
        ))}
      </div>

      {showLegend && zones.length > 0 && (
        <ul className="zone-legend">
          {zones.map((zone) => (
            <li key={zone.description}>
              <span className="zone-dot" style={{ background: zone.color }}></span>
              {zoneLabel(zone.description)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// `conference`: this is one conference's table (not the league-wide top teams
// on the home page, which are ordered by overall record).
function StandingsTable({ entries, league, conference = false }) {
  const { t } = useTranslation();
  // College conference tables are ranked by conference record. The bar then
  // shows that record too (W-L stay overall), so the order can be read off the
  // table — unless conference play hasn't started, when everyone is at 0%.
  const byConference =
    conference &&
    getLeague(league).standingsSort === "record" &&
    entries.some((e) => (stat(e, "leagueWinPercent")?.value ?? 0) > 0);

  return (
    <>
      <div className="standings-card">
        <div className="standings-header-row">
          <span>{t("standings.rank")}</span>
          <span>{t("standings.team")}</span>
          <span>{t("common.winAbbr")}</span>
          <span>{t("common.lossAbbr")}</span>
          <span className="standing-streak-head">{t("standings.streak")}</span>
          <span>{byConference ? t("standings.confPctAbbr") : t("common.pctWinAbbr")}</span>
        </div>

        {entries.map((entry, index) => {
          const wins = stat(entry, "wins")?.value ?? 0;
          const losses = stat(entry, "losses")?.value ?? 0;
          const winPercentStat = stat(entry, "winPercent");
          const confPct = (stat(entry, "leagueWinPercent")?.value ?? 0) * 100;
          const pct = byConference
            ? confPct
            : winPercentStat?.value != null
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
      {byConference && <p className="vb-note">{t("standings.confNote")}</p>}
    </>
  );
}

export default function Standings({ league, limit, grouped }) {
  const { t } = useTranslation();
  const soccer = getSport(league) === "soccer";
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
        {groups.map((group, index) => (
          <div key={group.id} className="section">
            {/* a single football table is already named by the page title */}
            {!(soccer && groups.length === 1) && (
              <div className="section-head">
                <div className="section-title standings-group-title">{group.name}</div>
              </div>
            )}
            {soccer ? (
              <SoccerTable
                entries={group.entries}
                league={league}
                // one legend for the whole page, under the last table, not eight identical ones
                showLegend={index === groups.length - 1}
              />
            ) : (
              <StandingsTable entries={group.entries} league={league} conference />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Football: the table is already ranked (ESPN's `rank`); win percentage
  // would put a team with few matches played above the leaders.
  const sorted = soccer
    ? [...allEntries].sort((a, b) => (stat(a, "rank")?.value ?? 99) - (stat(b, "rank")?.value ?? 99))
    : [...allEntries].sort(
        // among equal percentages the one with more wins is the better record
        // (28-0 above 3-0), then the one with fewer defeats
        (a, b) =>
          (stat(b, "winPercent")?.value ?? 0) - (stat(a, "winPercent")?.value ?? 0) ||
          (stat(b, "wins")?.value ?? 0) - (stat(a, "wins")?.value ?? 0) ||
          (stat(a, "losses")?.value ?? 0) - (stat(b, "losses")?.value ?? 0),
      );
  const shown = limit ? sorted.slice(0, limit) : sorted;

  return soccer ? (
    <SoccerTable entries={shown} league={league} showLegend={!limit} />
  ) : (
    <StandingsTable entries={shown} league={league} />
  );
}
