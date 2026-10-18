import { NCAA_UPSTREAM, resolveVolleyballRequest } from "./_lib/volleyball.js";

// GET /api/ncaa/volleyball?stat=42&page=2   -> a page of an NCAA player-stat
//                          ?scoreboard=YYYYMMDD -> that day's NCAA games
//                          ?boxscore=<gameId>   -> a match's per-player stats
// Responses are cached at the edge so upstream sees a handful of requests no
// matter how many visitors there are (the public ncaa-api instance allows only
// a few requests per second): leaderboards refresh about every 30 minutes, a
// finished match's box score never changes, and a live one is kept ~20s fresh.
function cacheControlFor(kind, data) {
  if (kind === "boxscore") {
    // status "F" = final: the numbers can't change anymore.
    return data.status === "F"
      ? "public, s-maxage=3600, stale-while-revalidate=86400"
      : "public, s-maxage=20, stale-while-revalidate=60";
  }
  if (kind === "scoreboard") return "public, s-maxage=300, stale-while-revalidate=3600";
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
    const upstream = await fetch(`${NCAA_UPSTREAM}${path}`, { headers: { accept: "application/json" } });
    const body = await upstream.text();

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.status(502).json({ error: "upstream_error", message: body.slice(0, 120) });
      return;
    }

    if (!upstream.ok) {
      res.status(upstream.status === 404 ? 404 : 502).json({ error: "upstream_error", message: data.message });
      return;
    }

    res.setHeader("Cache-Control", cacheControlFor(kind, data));
    res.status(200).json(data);
  } catch (err) {
    console.error("[ncaa]", err);
    res.status(502).json({ error: "upstream_unreachable" });
  }
}
