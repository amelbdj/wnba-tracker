import { getLeague } from "../src/leagues.js";
import { buildMeta, parseSharePath, renderShareHtml, resolveLang, resolveOrigin } from "./_lib/share.js";

// GET /api/share?path=/wnba/teams/20&lang=fr — the HTML that link-preview
// crawlers get for a page (vercel.json routes them here; see _lib/share.js).
// Team and player pages are looked up on ESPN so the preview names them; if
// ESPN is slow or down the page is still served, just with a generic line.

const ESPN_TIMEOUT_MS = 2500;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookUp(route) {
  const { sport } = route.league ? getLeague(route.league) : {};

  if (route.kind === "team" || route.kind === "volleyballPlayer") {
    const data = await getJson(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${route.league}/teams/${route.id}`,
    );
    const team = data?.team;
    if (!team) return {};
    return route.kind === "team"
      ? { name: team.displayName }
      : { team: team.shortDisplayName || team.displayName };
  }

  if (route.kind === "player") {
    const data = await getJson(
      `https://site.web.api.espn.com/apis/common/v3/sports/${sport}/${route.league}/athletes/${route.id}`,
    );
    const athlete = data?.athlete;
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
