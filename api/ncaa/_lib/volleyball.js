// NCAA.com's player stats for women's volleyball, read through the open-source
// ncaa-api wrapper (https://github.com/henrygd/ncaa-api). ncaa.com sends no CORS
// headers, so the browser can't call it directly: it goes through
// /api/ncaa/volleyball (Vercel function in production, Vite proxy in dev),
// which only ever builds these few known URLs.
export const NCAA_UPSTREAM = "https://ncaa-api.henrygd.me";

// Individual stat category ids that return data. (85, "Kills SG Highs", is
// listed by NCAA but its endpoint errors out upstream, so it's left out.)
export const VOLLEYBALL_STAT_IDS = new Set([
  1, 2, 3, 42, 43, 44, 552, 553, 879, 880, 883, 885, 887, 889, 890, 928,
]);

const MAX_PAGE = 20;

// -> "/stats/volleyball-women/d1/current/individual/42/p2", or null when the
// request isn't one of the known statistics pages.
export function buildVolleyballStatsPath({ stat, page } = {}) {
  const statId = Number(stat);
  const pageNumber = page == null || page === "" ? 1 : Number(page);
  if (!Number.isInteger(statId) || !VOLLEYBALL_STAT_IDS.has(statId)) return null;
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > MAX_PAGE) return null;

  const base = `/stats/volleyball-women/d1/current/individual/${statId}`;
  return pageNumber === 1 ? base : `${base}/p${pageNumber}`;
}

// -> "/scoreboard/volleyball-women/d1/2026/10/17" for "20261017", else null.
// Used to find NCAA's own game id for a match ESPN knows by a different id.
export function buildVolleyballScoreboardPath({ scoreboard } = {}) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(String(scoreboard ?? ""));
  if (!match) return null;
  const [, year, month, day] = match;
  if (Number(year) < 2020 || Number(year) > 2100) return null;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `/scoreboard/volleyball-women/d1/${year}/${month}/${day}`;
}

// -> "/game/6624613/boxscore" for a numeric NCAA game id, else null.
export function buildVolleyballBoxscorePath({ boxscore } = {}) {
  return /^\d{4,10}$/.test(String(boxscore ?? "")) ? `/game/${boxscore}/boxscore` : null;
}

// Which of the three supported requests a query is, and its upstream path:
//   ?stat=42&page=2    -> player leaderboard page
//   ?scoreboard=YYYYMMDD -> the day's games (to look up NCAA game ids)
//   ?boxscore=<gameId> -> a match's per-player box score
// Anything else (or anything malformed) -> null, so the proxy can never be
// pointed at an arbitrary upstream URL.
export function resolveVolleyballRequest(query = {}) {
  if (query.stat != null) {
    const path = buildVolleyballStatsPath(query);
    return path && { kind: "stats", path };
  }
  if (query.scoreboard != null) {
    const path = buildVolleyballScoreboardPath(query);
    return path && { kind: "scoreboard", path };
  }
  if (query.boxscore != null) {
    const path = buildVolleyballBoxscorePath(query);
    return path && { kind: "boxscore", path };
  }
  return null;
}
