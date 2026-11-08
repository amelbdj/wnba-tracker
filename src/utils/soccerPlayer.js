// A football player's numbers from ESPN's athlete "overview": season totals
// split by competition, and the last five matches. (The athlete's own
// "stats summary" is pinned to whichever competition ran last — a pre-season
// cup, say — and reads as zeros.)

// Which numbers to show, by kind of player, in this order.
const FIELD_PLAYER = ["starts", "totalGoals", "goalAssists", "totalShots", "shotsOnTarget", "yellowCards", "redCards"];
const GOALKEEPER = ["starts", "saves", "cleanSheet", "goalsConceded", "yellowCards", "redCards"];

// The totals of the league being looked at ("2026 NWSL") rather than of a
// friendly or a cup; failing that, the competition the player started most in.
export function pickSplit(overview, leagueSlug) {
  const splits = overview?.statistics?.splits || [];
  const names = overview?.statistics?.names || [];
  const starts = names.indexOf("starts");
  return (
    splits.find((s) => s.leagueSlug === leagueSlug) ||
    [...splits].sort((a, b) => (Number(b.stats?.[starts]) || 0) - (Number(a.stats?.[starts]) || 0))[0] ||
    null
  );
}

// -> { title, keeper, tiles: [{ name, value }] } or null without data.
export function buildSoccerStats(overview, leagueSlug) {
  const split = pickSplit(overview, leagueSlug);
  const names = overview?.statistics?.names;
  if (!split || !names) return null;

  const keeper = names.includes("saves");
  const wanted = keeper ? GOALKEEPER : FIELD_PLAYER;
  const tiles = wanted
    .filter((name) => names.includes(name))
    .map((name) => ({ name, value: split.stats?.[names.indexOf(name)] ?? "0" }));

  return { title: split.displayName, keeper, tiles };
}

// The last matches: [{ id, date, atVs, opponent, result, started, goals,
// assists, saves, yellow, red }], newest first.
export function buildSoccerRecent(overview, limit = 5) {
  const log = overview?.gameLog;
  const block = log?.statistics?.[0];
  if (!block?.events?.length) return [];

  const col = (name) => block.names.indexOf(name);
  const num = (row, name) => (col(name) >= 0 ? Number(row.stats?.[col(name)]) || 0 : 0);

  return block.events
    .map((row) => {
      const meta = log.events?.[row.eventId];
      if (!meta) return null;
      return {
        id: row.eventId,
        date: meta.gameDate,
        atVs: meta.atVs,
        opponent: { id: meta.opponent?.id, displayName: meta.opponent?.displayName },
        // ESPN says "T" for a tie
        result: meta.gameResult === "T" ? "D" : meta.gameResult,
        score: meta.score,
        started: row.stats?.[col("appearances")] === "Started",
        goals: num(row, "totalGoals"),
        assists: num(row, "goalAssists"),
        saves: num(row, "saves"),
        yellow: num(row, "yellowCards"),
        red: num(row, "redCards"),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}
