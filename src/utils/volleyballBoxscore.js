// NCAA box score -> what the match detail shows. NCAA sends every number as a
// string ("0", ".000", "1.5"), so this turns them into numbers where we do
// maths and leaves display strings (hitting %, block totals) as they came.

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Hitting percentage the way volleyball writes it: (kills - errors) / attempts
// to three decimals with no leading zero (".345", "-.050").
export function formatHitting(kills, errors, attempts) {
  if (attempts <= 0) return ".000";
  const value = ((kills - errors) / attempts).toFixed(3);
  return value.replace(/^(-?)0\./, "$1.");
}

// NCAA flags every rostered player as `participated` (and gives them all the
// match's set count) while a match is live, so "took part" has to be read from
// the stats: a starter, or anyone who registered something.
const ACTIVITY_FIELDS = [
  "points", "kills", "attackErrors", "attackAttempts", "assists", "serviceAces",
  "serviceErrors", "digs", "receptionErrors", "blockSolos", "blockAssists", "totalBlocks",
];

const tookPart = (p) => p.starter || ACTIVITY_FIELDS.some((field) => num(p[field]) !== 0);

function toPlayer(p) {
  const kills = num(p.kills);
  const errors = num(p.attackErrors);
  const attempts = num(p.attackAttempts);
  return {
    number: p.number,
    name: `${p.firstName} ${p.lastName}`.trim(),
    position: p.position,
    starter: Boolean(p.starter),
    sets: num(p.gamesPlayed),
    points: num(p.points),
    kills,
    errors,
    attempts,
    pct: formatHitting(kills, errors, attempts),
    assists: num(p.assists),
    aces: num(p.serviceAces),
    digs: num(p.digs),
    blocks: num(p.totalBlocks),
  };
}

// One team's rows (players who took part, best scorers first) plus a
// totals line summed from them.
export function buildTeamBoxscore(playerStats = []) {
  const players = playerStats
    .filter(tookPart)
    .map(toPlayer)
    .sort((a, b) => b.points - a.points || b.kills - a.kills || num(a.number) - num(b.number));

  const sum = (key) => players.reduce((total, p) => total + p[key], 0);
  const totals = {
    points: sum("points"),
    kills: sum("kills"),
    errors: sum("errors"),
    attempts: sum("attempts"),
    assists: sum("assists"),
    aces: sum("aces"),
    digs: sum("digs"),
    blocks: sum("blocks"),
  };
  totals.pct = formatHitting(totals.kills, totals.errors, totals.attempts);

  return { players, totals };
}

// `aIsHome` says whether ESPN's first team is NCAA's home team (they don't
// always agree on home/away for neutral-site matches), so the two returned
// teams line up with the ESPN match header: [teamA, teamB].
export function buildMatchBoxscore(box, aIsHome) {
  const homeId = box.teams?.find((t) => t.isHome)?.teamId;
  const awayId = box.teams?.find((t) => !t.isHome)?.teamId;
  const statsFor = (teamId) =>
    box.teamBoxscore?.find((t) => String(t.teamId) === String(teamId))?.playerStats || [];

  const [idA, idB] = aIsHome ? [homeId, awayId] : [awayId, homeId];
  return {
    isFinal: box.status === "F",
    teams: [buildTeamBoxscore(statsFor(idA)), buildTeamBoxscore(statsFor(idB))],
  };
}
