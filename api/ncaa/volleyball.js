import { fetchUpstream, resolveVolleyballRequest } from "./_lib/volleyball.js";

// GET /api/ncaa/volleyball?stat=42&page=2   -> a page of an NCAA player-stat
//                          ?scoreboard=YYYYMMDD -> that day's NCAA games
//                          ?boxscore=<gameId>   -> a match's per-player stats
// Responses are cached at the edge so upstream sees a handful of requests no
// matter how many visitors there are (the public ncaa-api instance allows only
// a few requests per second): leaderboards refresh about every 30 minutes, a
// finished match's box score hardly ever changes (kept a day), and a live one
// is kept ~20s fresh. Player and team pages replay a whole season of these, so
// the history is cached for long: a day that is over (more than two days ago)
// won't get new games, and neither will its scoreboard.
const DAY_MS = 24 * 60 * 60 * 1000;

function isPastDay(yyyymmdd) {
  const day = Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8));
  return Date.now() - day > 2 * DAY_MS;
}

function cacheControlFor(kind, data, query) {
  if (kind === "boxscore") {
    // status "F" = final: the numbers can't change anymore.
    return data.status === "F"
      ? "public, s-maxage=86400, stale-while-revalidate=604800"
      : "public, s-maxage=20, stale-while-revalidate=60";
  }
  if (kind === "scoreboard") {
    return isPastDay(String(query.scoreboard))
      ? "public, s-maxage=86400, stale-while-revalidate=604800"
      : "public, s-maxage=300, stale-while-revalidate=3600";
  }
  return "public, s-maxage=1800, stale-while-revalidate=21600";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const request = resolveVolleyballRequest(req.query);
  if (!request) {
    res.status(400).json({ error: "invalid_param", message: "Unknown or malformed request." });
    return;
  }
  const { kind, path } = request;

  try {
    const upstream = await fetchUpstream(path);

    if (!upstream.ok) {
      res.setHeader("Cache-Control", "no-store");
      const notFound = upstream.status === 404;
      res
        .status(notFound ? 404 : 502)
        .json({ error: "upstream_error", message: upstream.data?.message || `HTTP ${upstream.status}` });
      return;
    }

    res.setHeader("Cache-Control", cacheControlFor(kind, upstream.data, req.query));
    res.status(200).json(upstream.data);
  } catch (err) {
    console.error("[ncaa]", err);
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "upstream_unreachable" });
  }
}
