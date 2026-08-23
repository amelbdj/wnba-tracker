export async function getGamesByDate(date) {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${date}`,
  );
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
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/summary?event=${id}`,
  );
  const data = await res.json();
  return data;
}
