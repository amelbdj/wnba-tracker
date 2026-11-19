import { LEAGUES } from "../leagues.js";

// The one list of ESPN requests the app is allowed to make.
//
// It is shared by the server (api/espn.js, which turns a request into an ESPN
// URL and caches the answer) and the browser (which asks the server, or ESPN
// directly if the server is unavailable). Nothing outside this table can be
// fetched: the caller names a *kind* of request and fills in validated fields,
// and the URL is built from here. No path, host or free-form parameter ever
// comes from the outside, so the endpoint can't be used as an open proxy.
//
// Imports keep their ".js" extension: this file also runs in a Vercel
// function, where Node needs them spelled out.

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const CORE = "https://site.api.espn.com/apis/v2/sports";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports";
const SEARCH = "https://site.api.espn.com/apis/search/v2";

// Each field returns its cleaned-up value, or null when it isn't acceptable.
const FIELDS = {
  league: (v) => (LEAGUES.some((l) => l.slug === v) ? v : null),
  id: (v) => (/^\d{1,12}$/.test(v) ? v : null),
  event: (v) => (/^\d{1,12}$/.test(v) ? v : null),
  dates: (v) => {
    if (!/^\d{8}$/.test(v)) return null;
    const year = +v.slice(0, 4);
    const month = +v.slice(4, 6);
    const day = +v.slice(6, 8);
    return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31 ? v : null;
  },
  level: (v) => (/^[1-5]$/.test(v) ? v : null),
  limit: (v) => (/^\d{1,2}$/.test(v) && +v >= 1 && +v <= 50 ? String(+v) : null),
  query: (v) => {
    const q = v.trim();
    // eslint-disable-next-line no-control-regex
    return q.length >= 2 && q.length <= 60 && !/[\u0000-\u001f]/.test(q) ? q : null;
  },
};

const sportOf = (league) => LEAGUES.find((l) => l.slug === league).sport;

// required / optional fields and how to build the ESPN URL from them.
export const ESPN_KINDS = {
  scoreboard: {
    required: ["league", "dates"],
    url: (p) => `${SITE}/${sportOf(p.league)}/${p.league}/scoreboard?dates=${p.dates}`,
  },
  summary: {
    required: ["league", "event"],
    url: (p) => `${SITE}/${sportOf(p.league)}/${p.league}/summary?event=${p.event}`,
  },
  team: {
    required: ["league", "id"],
    url: (p) => `${SITE}/${sportOf(p.league)}/${p.league}/teams/${p.id}`,
  },
  roster: {
    required: ["league", "id"],
    url: (p) => `${SITE}/${sportOf(p.league)}/${p.league}/teams/${p.id}/roster`,
  },
  schedule: {
    required: ["league", "id"],
    url: (p) => `${SITE}/${sportOf(p.league)}/${p.league}/teams/${p.id}/schedule`,
  },
  statistics: {
    required: ["league"],
    url: (p) => `${SITE}/${sportOf(p.league)}/${p.league}/statistics`,
  },
  standings: {
    required: ["league"],
    optional: ["level"],
    url: (p) => `${CORE}/${sportOf(p.league)}/${p.league}/standings${p.level ? `?level=${p.level}` : ""}`,
  },
  athlete: {
    required: ["league", "id"],
    url: (p) => `${WEB}/${sportOf(p.league)}/${p.league}/athletes/${p.id}`,
  },
  athleteOverview: {
    required: ["league", "id"],
    url: (p) => `${WEB}/${sportOf(p.league)}/${p.league}/athletes/${p.id}/overview`,
  },
  athleteGameLog: {
    required: ["league", "id"],
    url: (p) => `${WEB}/${sportOf(p.league)}/${p.league}/athletes/${p.id}/gamelog`,
  },
  search: {
    required: ["query"],
    optional: ["limit"],
    url: (p) => `${SEARCH}?query=${encodeURIComponent(p.query)}&type=player&limit=${p.limit || 20}`,
  },
};

// -> { kind, params, url, query } for a valid request, or null.
//   params: the cleaned fields; url: the ESPN URL; query: the canonical query
//   string for our own endpoint (fields in alphabetical order, so the same
//   request is always the same URL and shares one cache entry).
// Anything unknown or malformed — an extra field, a repeated one, a bad id —
// makes the whole request invalid.
export function resolveEspnRequest(input) {
  if (!input || typeof input !== "object") return null;
  const kind = input.kind;
  if (typeof kind !== "string" || !Object.hasOwn(ESPN_KINDS, kind)) return null;
  const spec = ESPN_KINDS[kind];
  const allowed = [...spec.required, ...(spec.optional || [])];

  const params = {};
  for (const [key, raw] of Object.entries(input)) {
    if (key === "kind" || raw === undefined || raw === null || raw === "") continue;
    if (!allowed.includes(key)) return null;
    if (typeof raw !== "string" && typeof raw !== "number") return null;
    const value = FIELDS[key](String(raw));
    if (value === null) return null;
    params[key] = value;
  }
  if (spec.required.some((key) => params[key] === undefined)) return null;

  const query = new URLSearchParams(
    Object.entries({ kind, ...params }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ).toString();

  return { kind, params, url: spec.url(params), query };
}

// The hosts a request can ever reach (used by the tests as a safety net).
export const ESPN_HOSTS = ["site.api.espn.com", "site.web.api.espn.com"];
