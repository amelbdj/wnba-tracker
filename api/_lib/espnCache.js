// How long each kind of ESPN answer may be cached at Vercel's CDN.
//
//   s-maxage                 fresh: served without asking ESPN again
//   stale-while-revalidate   served right away while a fresh copy is fetched
//   stale-if-error           served if ESPN (or our function) fails, rather
//                            than an error — the "last known good answer"
//
// Live data is kept fresh ~20 s (the app polls every 20 s); things that
// can't change anymore (a day that is over, a finished match) are kept for a
// day; slow-moving things (rosters, profiles) for hours.
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const header = (fresh, swr, sie) =>
  `public, s-maxage=${fresh}, stale-while-revalidate=${swr}, stale-if-error=${sie}`;

const LIVE = header(20, 60, DAY);
const SETTLED = header(DAY, 7 * DAY, 7 * DAY); // can't change anymore
const UPCOMING = header(10 * MINUTE, HOUR, DAY);
const STANDINGS = header(10 * MINUTE, HOUR, DAY);
const TEAM = header(30 * MINUTE, 6 * HOUR, DAY);
const ROSTER = header(6 * HOUR, DAY, 7 * DAY);
const PROFILE = header(HOUR, 6 * HOUR, DAY);
const SEARCH = header(HOUR, DAY, DAY);

// A 404 is a real answer from ESPN (unknown team, a page that doesn't exist
// for this league): cached briefly so a repeated bad request doesn't keep
// hitting ESPN. It has no stale-if-error on purpose.
export const NOT_FOUND_CACHE = "public, s-maxage=60";

const utcDay = (yyyymmdd) =>
  Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8));

const MS_PER_DAY = 24 * 60 * 60 * 1000; // DAY above is in seconds (for headers)

// Whole days between today (UTC) and a YYYYMMDD date: negative = in the past.
function daysFromToday(yyyymmdd, now) {
  const today = new Date(now);
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((utcDay(yyyymmdd) - startOfToday) / MS_PER_DAY);
}

const isFinished = (summary) => summary?.header?.competitions?.[0]?.status?.type?.completed === true;

// The Cache-Control value for an answer. `data` is the parsed ESPN response:
// a match summary tells us whether the game is over.
export function cacheControlFor(kind, params, data, now = Date.now()) {
  switch (kind) {
    case "scoreboard": {
      // ESPN's days are US days, so "yesterday" and "tomorrow" can still
      // be live somewhere: only a day well in the past is settled.
      const diff = daysFromToday(params.dates, now);
      if (diff < -2) return SETTLED;
      if (diff > 1) return UPCOMING;
      return LIVE;
    }
    case "summary":
      return isFinished(data) ? SETTLED : LIVE;
    case "standings":
      return STANDINGS;
    case "team":
    case "schedule":
    case "statistics":
      return TEAM;
    case "roster":
    case "athlete":
      return ROSTER;
    case "athleteOverview":
    case "athleteGameLog":
      return PROFILE;
    case "search":
      return SEARCH;
    default:
      return header(60, 60, HOUR);
  }
}
