export function formatDateParam(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function getFeaturedGame(games) {
  if (!games.length) return null;

  const live = games.find((g) => g.status?.type?.state === "in");
  if (live) return live;

  const upcoming = games
    .filter((g) => g.status?.type?.state === "pre")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (upcoming.length) return upcoming[0];

  const final = games.find((g) => g.status?.type?.state === "post");
  if (final) return final;

  return games[0];
}
