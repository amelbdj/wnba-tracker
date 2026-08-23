const SITE_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba";
const WEB_API = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba";

export async function getGamesByDate(date) {
  const res = await fetch(`${SITE_API}/scoreboard?dates=${date}`);
  const data = await res.json();
  return data.events;
}
export async function getStandings() {
  const res = await fetch(
    "https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings",
  );

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
export async function getGameDetails(id) {
  const res = await fetch(`${SITE_API}/summary?event=${id}`);
  const data = await res.json();
  return data;
}

export async function getTeamDetails(teamId) {
  const res = await fetch(`${SITE_API}/teams/${teamId}`);
  const data = await res.json();
  return data.team;
}

export async function getTeamRoster(teamId) {
  const res = await fetch(`${SITE_API}/teams/${teamId}/roster`);
  const data = await res.json();
  return data.athletes || [];
}

export async function getPlayerProfile(playerId) {
  const res = await fetch(`${WEB_API}/athletes/${playerId}`);
  const data = await res.json();
  return data.athlete;
}

export async function getPlayerGameLog(playerId) {
  const res = await fetch(`${WEB_API}/athletes/${playerId}/gamelog`);
  if (!res.ok) return null;
  return res.json();
}

export async function getLeagueLeaders() {
  const res = await fetch(`${SITE_API}/statistics`);
  const data = await res.json();
  return data?.stats?.categories || [];
}

let allPlayersPromise = null;

// There is no single "all players" endpoint, so the directory is built by
// aggregating every team's roster. Cached in-memory for the session since
// it takes ~14 parallel requests to assemble.
export async function getAllPlayers() {
  if (!allPlayersPromise) {
    allPlayersPromise = (async () => {
      const groups = await getStandings();
      const teams = groups.flatMap((g) => g.entries.map((e) => e.team));

      const rosters = await Promise.all(
        teams.map(async (team) => {
          try {
            const athletes = await getTeamRoster(team.id);
            return athletes.map((athlete) => ({ ...athlete, team }));
          } catch {
            return [];
          }
        }),
      );

      return rosters.flat();
    })();
  }
  return allPlayersPromise;
}
