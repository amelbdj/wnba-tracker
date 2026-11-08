import { fetchAthlete, fetchTeam } from "./_lib/espn.js";
import { buildMeta, parseSharePath, renderShareHtml, resolveLang, resolveOrigin } from "./_lib/share.js";

// GET /api/share?path=/wnba/teams/20&lang=fr — the HTML that link-preview
// crawlers get for a page (vercel.json routes them here; see _lib/share.js).
// Team and player pages are looked up on ESPN so the preview names them; if
// ESPN is slow or down the page is still served, just with a generic line.
// The preview image is a separate function (api/og.js).

async function lookUp(route) {
  if (route.kind === "team") {
    const team = await fetchTeam(route);
    return team ? { name: team.displayName } : {};
  }

  if (route.kind === "volleyballPlayer") {
    const team = await fetchTeam(route);
    return team ? { team: team.shortDisplayName || team.displayName } : {};
  }

  if (route.kind === "player") {
    const athlete = await fetchAthlete(route);
    return athlete ? { name: athlete.displayName, team: athlete.team?.displayName } : {};
  }

  return {};
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end();
    return;
  }

  const lang = resolveLang(req.query?.lang);
  const route = parseSharePath(req.query?.path);
  const meta = buildMeta(route, lang, await lookUp(route));
  const origin = resolveOrigin(req.headers?.["x-forwarded-host"] || req.headers?.host);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Names change slowly; crawlers re-read a page rarely anyway.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(renderShareHtml(meta, { origin, lang }));
}
