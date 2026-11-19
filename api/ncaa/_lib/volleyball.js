// NCAA.com's player stats for women's volleyball, read through the open-source
// ncaa-api wrapper (https://github.com/henrygd/ncaa-api). ncaa.com sends no CORS
// headers, so the browser can't call it directly: it goes through
// /api/ncaa/volleyball (Vercel function in production, Vite proxy in dev),
// which only ever builds these few known URLs.
// The public instance: the fallback. Our own relay (see privateRelay below) is
// tried first when NCAA_API_URL and NCAA_API_KEY are set.
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

// ---- Talking to the upstream politely --------------------------------------
// Two relays serve the same data:
//   - our own, on the VPS (NCAA_API_URL + NCAA_API_KEY): tried first. It has no
//     rate limit of its own that matters here, is reached over HTTPS and
//     answers 401 without the key.
//   - the public instance: the fallback. It answers a burst of requests with an
//     HTML "428 Precondition Required" (or 429) page instead of data, and allows
//     about 3 requests per second per IP. A player page replays a whole season,
//     i.e. dozens of calls, so calls to it are kept to a few at a time and the
//     ones that get turned away are retried after a short wait.
// (Responses are cached at the edge, so most visitors never reach this.)
const PUBLIC_LIMITS = { maxInFlight: 4, attempts: 4, retryBaseMs: 450, timeoutMs: 15_000 };
const PRIVATE_LIMITS = { maxInFlight: 8, attempts: 2, retryBaseMs: 300, timeoutMs: 6_000 };

function createLimiter(max) {
  let inFlight = 0;
  const waiting = [];
  return {
    acquire() {
      if (inFlight < max) {
        inFlight += 1;
        return Promise.resolve();
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    release() {
      const next = waiting.shift();
      if (next) next(); // hand the slot straight over
      else inFlight -= 1;
    },
  };
}

const publicLimiter = createLimiter(PUBLIC_LIMITS.maxInFlight);
const privateLimiter = createLimiter(PRIVATE_LIMITS.maxInFlight);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// -> { base, key } when our own relay is configured, else null. The key is a
// secret sent in a header, so it only ever goes over HTTPS (plain http is
// accepted for localhost, to try things out) — a misconfigured URL turns the
// private relay off rather than sending the key in clear.
export function privateRelay(env = process.env) {
  const raw = (env.NCAA_API_URL || "").trim();
  const key = (env.NCAA_API_KEY || "").trim();
  if (!raw || !key) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  return { base: url.origin, key };
}

// Asks one relay for `path`, retrying when it turns us away. -> { status, ok,
// data } with `data` the parsed JSON (null when it answered with something
// else, e.g. its HTML rate-limit page). A 404 is final, whatever its body.
async function askRelay({ base, headers = {}, limiter, limits }, path) {
  let last = { status: 502, ok: false, data: null };

  for (let attempt = 0; attempt < limits.attempts; attempt += 1) {
    if (attempt > 0) await sleep(limits.retryBaseMs * attempt);

    await limiter.acquire();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { accept: "application/json", ...headers },
        signal: controller.signal,
      });
      const body = await res.text();
      let data = null;
      try {
        data = JSON.parse(body);
      } catch {
        // not JSON: a rate-limit or error page
      }
      last = { status: res.status, ok: res.ok && data !== null, data };

      if (res.status === 404) return last;
      const turnedAway = res.status === 428 || res.status === 429 || res.status >= 500 || data === null;
      if (!turnedAway) return last;
    } catch {
      last = { status: 502, ok: false, data: null };
    } finally {
      clearTimeout(timer);
      limiter.release();
    }
  }
  return last;
}

// -> { status, ok, data, source } where `source` is "private" or "public": which
// relay actually answered. Our own relay goes first; when it can't answer (down,
// slow, refusing the key, erroring) the public one takes over, so a problem on
// the VPS never takes the data away. A 404 from it is final: the match or page
// really doesn't exist.
export async function fetchUpstream(path, { env = process.env } = {}) {
  const relay = privateRelay(env);
  if (relay) {
    const result = await askRelay(
      { base: relay.base, headers: { "x-ncaa-key": relay.key }, limiter: privateLimiter, limits: PRIVATE_LIMITS },
      path,
    );
    if (result.ok || result.status === 404) return { ...result, source: "private" };
    // Never log the key; the status is enough to tell a refusal (401) from an outage.
    console.error(`[ncaa] own relay failed (HTTP ${result.status}) for ${path}; using the public one`);
  }

  const result = await askRelay(
    { base: NCAA_UPSTREAM, limiter: publicLimiter, limits: PUBLIC_LIMITS },
    path,
  );
  return { ...result, source: "public" };
}
