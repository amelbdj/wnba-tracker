const SITE_API_ROOT = "https://site.api.espn.com/apis/site/v2/sports/basketball";
const CORE_API_ROOT = "https://site.api.espn.com/apis/v2/sports/basketball";
const WEB_API_ROOT = "https://site.web.api.espn.com/apis/common/v3/sports/basketball";
const SEARCH_API = "https://site.api.espn.com/apis/search/v2";

export async function getGamesByDate(league, date) {
  const res = await fetch(`${SITE_API_ROOT}/${league}/scoreboard?dates=${date}`);
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
  const res = await fetch(`${CORE_API_ROOT}/${league}/standings`);
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
      const res = await fetch(`${SITE_API_ROOT}/${league}/scoreboard?dates=${formatYYYYMMDD(day)}`);
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

export async function getStandings(league) {
  const res = await fetch(`${CORE_API_ROOT}/${league}/standings`);
  const data = await res.json();

  const groups = data?.children;

  if (groups && groups.length > 0) {
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      abbreviation: g.abbreviation,
      entries: sortEntriesByRank(g.standings?.entries || []),
    }));
  }

  return [];
}

export async function getGameDetails(league, id) {
  const res = await fetch(`${SITE_API_ROOT}/${league}/summary?event=${id}`);
  const data = await res.json();
  return data;
}

export async function getTeamDetails(league, teamId) {
  const res = await fetch(`${SITE_API_ROOT}/${league}/teams/${teamId}`);
  const data = await res.json();
  return data.team;
}

export async function getTeamRoster(league, teamId) {
  const res = await fetch(`${SITE_API_ROOT}/${league}/teams/${teamId}/roster`);
  const data = await res.json();
  return data.athletes || [];
}

export async function getPlayerProfile(league, playerId) {
  const res = await fetch(`${WEB_API_ROOT}/${league}/athletes/${playerId}`);
  const data = await res.json();
  return data.athlete;
}

export async function getPlayerGameLog(league, playerId) {
  const res = await fetch(`${WEB_API_ROOT}/${league}/athletes/${playerId}/gamelog`);
  if (!res.ok) return null;
  return res.json();
}

export async function getLeagueLeaders(league) {
  const res = await fetch(`${SITE_API_ROOT}/${league}/statistics`);
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
