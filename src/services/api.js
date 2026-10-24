import { getLeague, getSport } from "../leagues";
import { findNcaaGame } from "../utils/ncaaTeams";
import { formatDateParam } from "../utils/games";
import { buildMatchBoxscore, buildRoster } from "../utils/volleyballBoxscore";

// ESPN's URLs embed the sport (…/sports/basketball/wnba/…,
// …/sports/volleyball/womens-college-volleyball/…), so every root is derived
// from the league being asked about rather than fixed to one sport.
const siteRoot = (league) => `https://site.api.espn.com/apis/site/v2/sports/${getSport(league)}`;
const coreRoot = (league) => `https://site.api.espn.com/apis/v2/sports/${getSport(league)}`;
const webRoot = (league) => `https://site.web.api.espn.com/apis/common/v3/sports/${getSport(league)}`;
const SEARCH_API = "https://site.api.espn.com/apis/search/v2";

export async function getGamesByDate(league, date) {
  const res = await fetch(`${siteRoot(league)}/${league}/scoreboard?dates=${date}`);
  const data = await res.json();
  return data.events;
}

function formatYYYYMMDD(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

// The core standings endpoint's `seasons` list carries the exact
// pre/regular/postseason date windows for the most recent season that has
// real standings data — including a season that has already finished, since
// ESPN keeps serving its final standings until the next season's games
// actually start being recorded. This is far more precise than guessing a
// trailing window off the "current" season's nominal end date, and it's
// what lets the bracket know exactly where to look for real playoff games
// (or that a just-finished tournament should still be shown as final).
export async function getSeasonWindows(league) {
  const res = await fetch(`${coreRoot(league)}/${league}/standings`);
  const data = await res.json();
  const latest = data?.seasons?.[0];
  if (!latest) return null;

  const findWindow = (abbr) => {
    const type = latest.types?.find((t) => t.abbreviation === abbr);
    return type ? { startDate: type.startDate, endDate: type.endDate } : null;
  };

  return {
    year: latest.year,
    displayName: latest.displayName,
    regular: findWindow("reg"),
    postseason: findWindow("post"),
  };
}

function eachDay(startDate, endDate) {
  const days = [];
  const cursor = new Date(startDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// Fetches every scoreboard event across a date window, one day at a time in
// parallel. The scoreboard's `dates=start-end` range syntax silently returns
// nothing for some leagues (e.g. NCAA), so day-by-day is what actually works
// everywhere — the windows involved are only a few weeks long either way.
async function getGamesInWindow(league, window) {
  if (!window?.startDate || !window?.endDate) return [];

  const days = eachDay(window.startDate, window.endDate);
  const perDay = await Promise.all(
    days.map(async (day) => {
      const res = await fetch(`${siteRoot(league)}/${league}/scoreboard?dates=${formatYYYYMMDD(day)}`);
      const data = await res.json();
      return data.events || [];
    }),
  );

  const byId = new Map();
  for (const event of perDay.flat()) byId.set(event.id, event);
  return [...byId.values()];
}

// ESPN has no dedicated "bracket" endpoint — postseason games are just
// regular scoreboard events tagged `season.type === 3`, fetched here across
// the exact postseason date window from getSeasonWindows().
export async function getPostseasonGames(league, window) {
  const events = await getGamesInWindow(league, window);
  return events.filter((e) => e.season?.type === 3);
}

// Some competitions (FIBA World Cup, Olympics) run as a single short
// tournament with no separate "postseason" season type at all — group stage
// and knockout games are both tagged as one "regular season". For those,
// every game in the tournament window is returned so the caller can split
// knockout-stage games from group-stage ones itself (by round label).
export async function getTournamentGames(league, window) {
  return getGamesInWindow(league, window);
}

// ESPN doesn't guarantee standings entries arrive in rank order (WNBA does,
// but NCAA's conferences come back in an arbitrary order) — sort explicitly
// by seed, falling back to win percentage when no seed is reported.
function sortEntriesByRank(entries) {
  return [...entries].sort((a, b) => {
    const seedA = a.stats?.find((s) => s.name === "playoffSeed")?.value;
    const seedB = b.stats?.find((s) => s.name === "playoffSeed")?.value;
    if (seedA != null && seedB != null) return seedA - seedB;

    const pctA = a.stats?.find((s) => s.name === "winPercent")?.value ?? 0;
    const pctB = b.stats?.find((s) => s.name === "winPercent")?.value ?? 0;
    return pctB - pctA;
  });
}

// ESPN nests standings groups by depth (division -> conference -> ...) and
// only some nodes carry entries. This flattens to the groups that actually
// list teams — the conferences, for NCAA volleyball.
function collectGroups(node, out = []) {
  if (node.standings?.entries?.length) out.push(node);
  for (const child of node.children || []) collectGroups(child, out);
  return out;
}

export async function getStandings(league) {
  const level = getLeague(league).standingsLevel;
  const url = `${coreRoot(league)}/${league}/standings${level ? `?level=${level}` : ""}`;
  const res = await fetch(url);
  const data = await res.json();

  const groups = (data?.children || []).flatMap((child) => collectGroups(child));
  if (groups.length > 0) {
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      abbreviation: g.abbreviation,
      entries: sortEntriesByRank(g.standings.entries),
    }));
  }

  return [];
}

export async function getGameDetails(league, id) {
  const res = await fetch(`${siteRoot(league)}/${league}/summary?event=${id}`);
  const data = await res.json();
  return data;
}

// ESPN's `teams/{id}` endpoint sends no CORS headers (for any origin), so a
// browser can't read it — the request fails outright. When that happens the
// team is rebuilt from the standings entry instead, which has the same
// record stats the page uses (just no next game or team colour).
export async function getTeamDetails(league, teamId) {
  try {
    const res = await fetch(`${siteRoot(league)}/${league}/teams/${teamId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.team) return data.team;
    }
  } catch {
    // fall through to the standings-based fallback
  }

  const groups = await getStandings(league);
  const entry = groups.flatMap((g) => g.entries).find((e) => String(e.team?.id) === String(teamId));
  if (!entry) return null;
  return { ...entry.team, record: { items: [{ description: "Overall Record", stats: entry.stats }] } };
}

export async function getTeamRoster(league, teamId) {
  const res = await fetch(`${siteRoot(league)}/${league}/teams/${teamId}/roster`);
  const data = await res.json();
  return data.athletes || [];
}

export async function getPlayerProfile(league, playerId) {
  const res = await fetch(`${webRoot(league)}/${league}/athletes/${playerId}`);
  const data = await res.json();
  return data.athlete;
}

export async function getPlayerGameLog(league, playerId) {
  const res = await fetch(`${webRoot(league)}/${league}/athletes/${playerId}/gamelog`);
  if (!res.ok) return null;
  return res.json();
}

export async function getLeagueLeaders(league) {
  const res = await fetch(`${siteRoot(league)}/${league}/statistics`);
  const data = await res.json();
  return data?.stats?.categories || [];
}

// Full-text player search across ESPN, used for leagues too large to
// aggregate every team roster (e.g. NCAA's 360+ teams). Results are
// filtered down to the requested league via defaultLeagueSlug.
export async function searchPlayers(league, query) {
  if (!query || query.trim().length < 2) return [];

  const res = await fetch(
    `${SEARCH_API}?query=${encodeURIComponent(query.trim())}&type=player&limit=20`,
  );
  const data = await res.json();
  const contents = data?.results?.find((r) => r.type === "player")?.contents || [];

  return contents
    .filter((p) => p.defaultLeagueSlug === league)
    .map((p) => {
      const idMatch = p.uid?.match(/a:(\d+)/);
      return {
        id: idMatch ? idMatch[1] : p.id,
        displayName: p.displayName,
        headshot: p.image?.default ? { href: p.image.default } : null,
        team: p.subtitle ? { displayName: p.subtitle } : null,
      };
    })
    .filter((p) => p.id);
}

const allPlayersPromises = {};

// There is no single "all players" endpoint, so the directory is built by
// aggregating every team's roster. Only viable for leagues with a small
// team count (see LEAGUES[].playersMode) — cached in-memory per league
// for the session since it takes many parallel requests to assemble.
export async function getAllPlayers(league) {
  if (!allPlayersPromises[league]) {
    allPlayersPromises[league] = (async () => {
      const groups = await getStandings(league);
      const teams = groups.flatMap((g) => g.entries.map((e) => e.team));

      const rosters = await Promise.all(
        teams.map(async (team) => {
          try {
            const athletes = await getTeamRoster(league, team.id);
            return athletes.map((athlete) => ({ ...athlete, team }));
          } catch {
            return [];
          }
        }),
      );

      return rosters.flat();
    })();
  }
  return allPlayersPromises[league];
}

// One page (50 players) of an NCAA.com player-stat leaderboard for women's
// volleyball. Goes through our own /api/ncaa/volleyball endpoint because
// ncaa.com can't be called from a browser (no CORS headers).
export async function getVolleyballLeaders(statId, page = 1) {
  return getNcaaVolleyball({ stat: statId, page });
}

async function getNcaaVolleyball(query) {
  const res = await fetch(`/api/ncaa/volleyball?${new URLSearchParams(query)}`);
  if (!res.ok) throw new Error(`NCAA data unavailable (HTTP ${res.status})`);
  return res.json();
}

// Memoises an async lookup by key. A rejected promise is dropped from the
// cache so the next call retries; `keep` can refuse to cache a result (live
// box scores change, so only final ones are kept).
function memoAsync(cache, key, load, keep = () => true) {
  if (!cache.has(key)) {
    const promise = load();
    cache.set(key, promise);
    promise.then(
      (value) => {
        if (!keep(value)) cache.delete(key);
      },
      () => cache.delete(key),
    );
  }
  return cache.get(key);
}

const ncaaScoreboards = new Map();
const ncaaGameLookups = new Map();
const finalBoxscores = new Map();

// ESPN and NCAA.com share no match id, so a match's NCAA id is looked up once
// (from that day's NCAA scoreboard, by the two teams) and remembered — the
// live refresh then only re-reads the box score.
function lookupNcaaGame(competition) {
  return memoAsync(ncaaGameLookups, competition.id || competition.date, async () => {
    const day = formatDateParam(new Date(competition.date));
    const { games } = await memoAsync(ncaaScoreboards, day, () => getNcaaVolleyball({ scoreboard: day }));
    const [a, b] = competition.competitors;
    return findNcaaGame(games.map((g) => g.game), a.team, b.team);
  });
}

// How many of a team's latest finished matches feed its squad list.
const ROSTER_MATCHES = 5;

// Per-player stats for an ESPN volleyball match (its header `competition`),
// from NCAA.com's box score. Resolves to { isFinal, teams: [teamA, teamB] },
// or null when NCAA.com has no matching game. Finished matches are cached.
export function getVolleyballBoxscore(competition) {
  const key = `${competition.id}:${competition.competitors[0].team.id}`;
  return memoAsync(
    finalBoxscores,
    key,
    async () => {
      const found = await lookupNcaaGame(competition);
      if (!found) return null;
      const box = await getNcaaVolleyball({ boxscore: found.game.gameID });
      return buildMatchBoxscore(box, found.aIsHome);
    },
    (box) => box?.isFinal,
  );
}

// A team's whole season as ESPN lists it (played and still to come), oldest
// first. Each event is { id, date, competitions: [{ competitors, status }] }.
export async function getTeamSchedule(league, teamId) {
  const res = await fetch(`${siteRoot(league)}/${league}/teams/${teamId}/schedule`);
  if (!res.ok) throw new Error(`Schedule unavailable (HTTP ${res.status})`);
  const { events = [] } = await res.json();
  return events;
}

// How many matches are fetched at once (the public NCAA.com wrapper allows
// only a few requests per second).
const MATCH_BATCH = 6;
const teamMatches = new Map();

const scoreOf = (c) => Number(c.score?.displayValue ?? c.score) || 0;

// A team's finished matches (newest first, at most `limit`), each with that
// team's per-player box score: { id, date, opponent, home, score: [us, them],
// won, players }. NCAA.com has no rosters or player pages, so squads and
// player profiles are all built from these. Matches NCAA.com can't be matched
// to are left out.
export function getVolleyballTeamMatches(league, teamId, limit = Infinity) {
  return memoAsync(teamMatches, `${league}:${teamId}:${limit}`, async () => {
    const events = await getTeamSchedule(league, teamId);

    const finished = events
      .map((e) => e.competitions?.[0])
      .filter((c) => c?.status?.type?.completed && c.competitors?.length === 2)
      .reverse()
      .slice(0, limit);

    const matches = [];
    for (let i = 0; i < finished.length; i += MATCH_BATCH) {
      const results = await Promise.allSettled(
        finished.slice(i, i + MATCH_BATCH).map(async (competition) => {
          const side = competition.competitors.findIndex((c) => String(c.team.id) === String(teamId));
          const box = await getVolleyballBoxscore(competition);
          if (!box || side < 0) return null;
          const us = competition.competitors[side];
          const them = competition.competitors[1 - side];
          return {
            id: competition.id,
            date: competition.date,
            opponent: {
              id: them.team.id,
              displayName: them.team.displayName,
              abbreviation: them.team.abbreviation,
              logo: them.team.logos?.[0]?.href || them.team.logo,
            },
            home: us.homeAway === "home",
            score: [scoreOf(us), scoreOf(them)],
            won: scoreOf(us) > scoreOf(them),
            players: box.teams[side].players,
          };
        }),
      );
      for (const r of results) if (r.status === "fulfilled" && r.value) matches.push(r.value);
    }
    return matches.sort((a, b) => new Date(b.date) - new Date(a.date));
  });
}

// NCAA.com has no rosters, and ESPN's athlete lists for volleyball are every
// player a program ever had. So the current squad is read off the box scores
// of the team's latest finished matches: everyone who shows up there, with
// their jersey number and position. Resolves to { players, matches } where
// `matches` is how many box scores were found (0 = nothing available).
export async function getVolleyballRoster(league, teamId) {
  const matches = await getVolleyballTeamMatches(league, teamId, ROSTER_MATCHES);
  return { players: buildRoster(matches), matches: matches.length };
}
