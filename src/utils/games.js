// ESPN files every game under its US (Eastern) calendar day — a game tipping
// off at 8pm ET carries a UTC timestamp on the *next* day, but still lives
// under the earlier `dates=` value. Using the UTC date (the old behaviour)
// made tonight's games vanish from the scoreboard as soon as UTC midnight
// passed, i.e. exactly during the evening hours when games are live.
const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateParam(date) {
  const parts = Object.fromEntries(ET_PARTS.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

export function getFeaturedGame(games) {
  if (!games.length) return null;

  const live = games.find((g) => g.status?.type?.state === "in");
  if (live) return live;

  const upcoming = games
    .filter((g) => g.status?.type?.state === "pre")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (upcoming.length) return upcoming[0];

  const final = games.find((g) => g.status?.type?.state === "post");
  if (final) return final;

  return games[0];
}

const LIVE_POLL_MS = 20 * 1000;
const SOON_WINDOW_MS = 30 * 60 * 1000;
const UPCOMING_WINDOW_MS = 6 * 60 * 60 * 1000;
const UPCOMING_POLL_MS = 60 * 1000;

// How often a list of games should refresh itself, or null when nothing is
// worth polling for (everything finished, or the next tip-off is far away).
//  - a game in progress           -> every 20s, so scores/clock feel live
//  - a game about to start        -> every 20s, so it flips to live promptly
//  - a game later in the day      -> every 60s heartbeat (cheap), which also
//                                    re-evaluates this as tip-off approaches
export function getPollInterval(games, now = Date.now()) {
  if (!games?.length) return null;

  let interval = null;
  for (const game of games) {
    const state = game.status?.type?.state;
    if (state === "in") return LIVE_POLL_MS;
    if (state === "pre") {
      const untilStart = new Date(game.date).getTime() - now;
      if (untilStart <= SOON_WINDOW_MS) return LIVE_POLL_MS;
      if (untilStart <= UPCOMING_WINDOW_MS) interval = UPCOMING_POLL_MS;
    }
  }
  return interval;
}

// What to show next to the LIVE badge: a basketball clock ("Q3 · 4:32") or,
// for volleyball, which set is being played ("Set 3") — volleyball has no
// running game clock.
export function getLiveDetail(game, sport, t) {
  const { period, displayClock, type } = game.status || {};
  const fallback = type?.shortDetail || type?.description || "";
  if (sport === "volleyball") return period ? t("game.set", { number: period }) : fallback;
  return displayClock && period ? `Q${period} · ${displayClock}` : fallback;
}

// Points per period for a basketball game: [{ label, scores: [teamA, teamB] }],
// where label is "Q1".."Q4" then "OT", "OT2"… (regulation is four periods in
// every league the app covers). ESPN lists a period still being played with
// its running score.
export function getPeriodScores(competition) {
  const [a, b] = competition?.competitors || [];
  const aPeriods = a?.linescores || [];
  const bPeriods = b?.linescores || [];
  const count = Math.max(aPeriods.length, bPeriods.length);
  const points = (line) => Math.round(Number(line?.displayValue ?? line?.value ?? 0)) || 0;

  return Array.from({ length: count }, (_, i) => ({
    label: i < 4 ? `Q${i + 1}` : i === 4 ? "OT" : `OT${i - 3}`,
    scores: [points(aPeriods[i]), points(bPeriods[i])],
  }));
}

// Points per set for a volleyball match, as [[teamA, teamB], ...]. In
// volleyball ESPN's `score` is sets won and `linescores` holds each set's
// points. A set still being played shows up as its running score.
export function getSetScores(competition) {
  const [a, b] = competition?.competitors || [];
  const aSets = a?.linescores || [];
  const bSets = b?.linescores || [];
  const count = Math.max(aSets.length, bSets.length);
  return Array.from({ length: count }, (_, i) => [
    Math.round(Number(aSets[i]?.value ?? aSets[i]?.displayValue ?? 0)),
    Math.round(Number(bSets[i]?.value ?? bSets[i]?.displayValue ?? 0)),
  ]);
}
