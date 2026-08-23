const SITE_API_ROOT = "https://site.api.espn.com/apis/site/v2/sports/basketball";
const CORE_API_ROOT = "https://site.api.espn.com/apis/v2/sports/basketball";
const WEB_API_ROOT = "https://site.web.api.espn.com/apis/common/v3/sports/basketball";
const SEARCH_API = "https://site.api.espn.com/apis/search/v2";

export async function getGamesByDate(league, date) {
  const res = await fetch(`${SITE_API_ROOT}/${league}/scoreboard?dates=${date}`);
  const data = await res.json();
  return data.events;
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
      entries: g.standings?.entries || [],
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
