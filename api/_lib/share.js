import { getLeague, LEAGUES } from "../../src/leagues.js";
import { DEFAULT_LANG, LANGS, OG_LOCALE, SITE_TITLE, fill, textFor } from "./shareText.js";

// Link previews. Apps that unfurl a pasted link (WhatsApp, iMessage, Discord,
// Slack, X, Telegram, Facebook…) read the page's HTML without running any
// JavaScript, and this site is a single-page app: every URL used to answer
// with the same bare index.html. vercel.json sends those apps' requests here
// instead, and this builds a small HTML page with the right title,
// description and image for the URL they asked about. Real visitors never see it.

export const SITE_URL = "https://thefrontrow.fr";
export const OG_IMAGE_PATH = "/og-default.png";
const MAX_DESCRIPTION = 200;

const LEAGUE_SLUGS = new Set(LEAGUES.map((l) => l.slug));
const SECTIONS = new Set(["standings", "playoffs", "teams", "players", "statistics"]);

export function resolveLang(value) {
  return LANGS.includes(value) ? value : DEFAULT_LANG;
}

// "/wnba/teams/20" -> { kind: "team", league: "wnba", id: "20" }. Anything
// that isn't a page of the app -> { kind: "site" }, so a made-up path can
// never put its own text into a preview.
export function parseSharePath(path) {
  const clean = String(path || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return { kind: "site" };
  if (clean === "/privacy") return { kind: "page", page: "privacy", canonical: "/privacy" };
  if (clean === "/terms") return { kind: "page", page: "terms", canonical: "/terms" };

  const parts = clean.slice(1).split("/");
  const [league, section, id, sub, slug] = parts;
  if (!LEAGUE_SLUGS.has(league)) return { kind: "site" };

  const base = `/${league}`;
  if (parts.length === 1) return { kind: "league", league, section: "", canonical: base };
  if (parts.length === 2 && SECTIONS.has(section)) {
    return { kind: "league", league, section, canonical: `${base}/${section}` };
  }
  if (section === "teams" && /^\d{1,9}$/.test(id || "")) {
    if (parts.length === 3) return { kind: "team", league, id, canonical: `${base}/teams/${id}` };
    if (parts.length === 5 && sub === "players" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || "")) {
      return {
        kind: "volleyballPlayer",
        league,
        id,
        slug,
        canonical: `${base}/teams/${id}/players/${slug}`,
      };
    }
  }
  if (section === "players" && parts.length === 3 && /^\d{1,9}$/.test(id || "")) {
    return { kind: "player", league, id, canonical: `${base}/players/${id}` };
  }
  return { kind: "league", league, section: "", canonical: base };
}

// "gabby-divita" -> "Gabby Divita": all the page's URL says about a volleyball
// player (the real spelling would take reading a whole season of box scores).
export function nameFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function clip(text) {
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text;
}

// `data` is what the handler could look up for the page: { name } for
// a team, { name, team } for a player. Missing data degrades to a generic line.
export function buildMeta(route, lang, data = {}) {
  const meta = buildText(route, lang, data);
  // Pages with a card of their own point at api/og; the rest keep the brand image.
  const hasCard = ["league", "team", "player", "volleyballPlayer"].includes(route.kind);
  return hasCard
    ? { ...meta, image: `/api/og?path=${encodeURIComponent(route.canonical)}&lang=${lang}` }
    : meta;
}

function buildText(route, lang, data) {
  const text = textFor(lang);
  const leagueName = route.league ? text.leagues[route.league] ?? getLeague(route.league).shortLabel : "";
  const withBrand = (title) => `${title} | FRONTROW`;

  switch (route.kind) {
    case "league": {
      const section = text.sections[route.section] ?? text.sections[""];
      return {
        title: withBrand(fill(section.title, { league: leagueName })),
        description: fill(section.description, { league: leagueName }),
        path: route.canonical,
      };
    }
    case "team": {
      const t = data.name
        ? {
            title: fill(text.team.title, { name: data.name, league: leagueName }),
            description: fill(text.team.description, { name: data.name, league: leagueName }),
          }
        : {
            title: fill(text.teamFallback.title, { league: leagueName }),
            description: fill(text.teamFallback.description, { league: leagueName }),
          };
      return { ...t, title: withBrand(t.title), path: route.canonical };
    }
    case "player":
    case "volleyballPlayer": {
      const name = data.name || (route.slug ? nameFromSlug(route.slug) : "");
      let t;
      if (!name) {
        t = {
          title: fill(text.playerFallback.title, { league: leagueName }),
          description: fill(text.playerFallback.description, { league: leagueName }),
        };
      } else if (data.team) {
        const description =
          route.kind === "volleyballPlayer" ? text.volleyballPlayer.description : text.player.description;
        t = {
          title: fill(text.player.title, { name, team: data.team }),
          description: fill(description, { name, team: data.team, league: leagueName }),
        };
      } else {
        t = {
          title: fill(text.playerNoTeam.title, { name, league: leagueName }),
          description: fill(text.playerNoTeam.description, { name, league: leagueName }),
        };
      }
      return { ...t, title: withBrand(t.title), path: route.canonical };
    }
    case "page": {
      const page = text.pages[route.page];
      return { title: withBrand(page.title), description: page.description, path: route.canonical };
    }
    default:
      return { title: SITE_TITLE, description: text.siteDescription, path: "/" };
  }
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Hosts we're willing to echo back as the page's own address (the site, plus
// Vercel preview deployments, so a preview's links can be tested).
export function resolveOrigin(host) {
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host || "") && !/^localhost\b/i.test(host)
    ? `https://${host}`
    : SITE_URL;
}

export function renderShareHtml(meta, { origin = SITE_URL, lang = DEFAULT_LANG } = {}) {
  const url = `${origin}${meta.path === "/" ? "/" : meta.path}`;
  const image = `${origin}${meta.image || OG_IMAGE_PATH}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(clip(meta.description));
  const e = escapeHtml;

  return `<!doctype html>
<html lang="${e(lang)}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${e(url)}">
<meta property="og:site_name" content="FRONTROW">
<meta property="og:type" content="website">
<meta property="og:locale" content="${OG_LOCALE[lang] ?? OG_LOCALE[DEFAULT_LANG]}">
<meta property="og:url" content="${e(url)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${e(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="FRONTROW — The home of women's sports.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${e(image)}">
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
<p><a href="${e(url)}">${e(url)}</a></p>
</body>
</html>
`;
}
