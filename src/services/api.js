export async function getGamesByDate(date) {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${date}`,
  );
  const data = await res.json();
  return data.events;
}
