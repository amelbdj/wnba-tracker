import { getLeague } from "../src/leagues.js";
import { fetchAthlete, fetchImageDataUri, fetchTeam, pickLogoUrl } from "./_lib/espn.js";
import { leagueCard, playerCard, renderCard, teamCard } from "./_lib/ogCard.js";
import { nameFromSlug, parseSharePath, resolveLang } from "./_lib/share.js";
import { textFor } from "./_lib/shareText.js";

// GET /api/og?path=/wnba/teams/20&lang=fr — the 1200x630 preview image for a
// page (api/share.js points og:image here). Like the share page it only takes
// a path, never text, and looks the names up itself, so the URL can't be used
// to put arbitrary words on a FRONTROW-branded image. Anything that goes wrong
// (ESPN down, unknown page) answers with a redirect to the static brand card.

const DEFAULT_IMAGE = "/og-default.png";

// How long a card stays fresh at the edge: leagues never change, a team's
// name/logo hardly do, players' season stats move after each game.
const MAX_AGE = { league: 7 * 86400, team: 86400, volleyballPlayer: 86400, player: 6 * 3600 };

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// -> { card, tree } or null when the page has no card of its own.
async function buildCard(route, lang) {
  const leagueName = textFor(lang).leagues[route.league];

  if (route.kind === "league") {
    return leagueCard(lang, { leagueName, sport: getLeague(route.league).sport, section: route.section });
  }

  if (route.kind === "team") {
    const team = await fetchTeam(route);
    if (!team) return null;
    const logo = await fetchImageDataUri(pickLogoUrl(team));
    return teamCard(lang, { name: team.displayName, leagueName, color: team.color, logo });
  }

  if (route.kind === "volleyballPlayer") {
    const team = await fetchTeam(route);
    if (!team) return null;
    const logo = await fetchImageDataUri(pickLogoUrl(team));
    const name = nameFromSlug(route.slug);
    return playerCard(lang, {
      name,
      leagueName,
      color: team.color,
      logo,
      initials: initialsOf(name),
      subtitle: team.shortDisplayName || team.displayName,
      tagline: textFor(lang).card.volleyballPlayerTagline,
    });
  }

  if (route.kind === "player") {
    const athlete = await fetchAthlete(route);
    if (!athlete) return null;
    const [headshot, logo] = await Promise.all([
      fetchImageDataUri(athlete.headshot?.href),
      fetchImageDataUri(pickLogoUrl(athlete.team)),
    ]);
    const summary = athlete.statsSummary;
    return playerCard(lang, {
      name: athlete.displayName,
      leagueName,
      color: athlete.team?.color,
      logo,
      headshot,
      initials: initialsOf(athlete.displayName),
      subtitle: [athlete.team?.displayName, athlete.position?.displayName, athlete.displayJersey]
        .filter(Boolean)
        .join(" · "),
      // ESPN's football summary is pinned to whichever cup ran last (zeros), so
      // football cards show no numbers rather than misleading ones.
      stats:
        getLeague(route.league).sport === "soccer"
          ? []
          : (summary?.statistics || []).map((s) => ({ label: s.shortDisplayName || s.abbreviation, value: s.displayValue })),
      season: /\b(\d{4})\b/.exec(summary?.displayName || "")?.[1],
    });
  }

  return null;
}

function fallback(res) {
  res.setHeader("Cache-Control", "public, s-maxage=300");
  res.setHeader("Location", DEFAULT_IMAGE);
  res.status(302).end();
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end();
    return;
  }

  const lang = resolveLang(req.query?.lang);
  const route = parseSharePath(req.query?.path);

  try {
    const tree = await buildCard(route, lang);
    if (!tree) return fallback(res);

    const image = await renderCard(tree);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", `public, s-maxage=${MAX_AGE[route.kind]}, stale-while-revalidate=86400`);
    res.status(200).send(image);
  } catch (err) {
    console.error("[og]", err);
    fallback(res);
  }
}
