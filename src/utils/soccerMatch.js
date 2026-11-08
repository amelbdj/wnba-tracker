// Turning ESPN's football match summary into what the match detail shows: a
// timeline of the key events, side-by-side team statistics and the line-ups.

// The team stats worth showing, in the order they're shown (ESPN sends 23-28,
// most of them too fine-grained for a match page).
export const SOCCER_STATS = [
  "possessionPct",
  "totalShots",
  "shotsOnTarget",
  "wonCorners",
  "totalPasses",
  "passPct",
  "foulsCommitted",
  "offsides",
  "saves",
  "yellowCards",
  "redCards",
];

// ESPN writes rates as fractions ("0.8" for 80%) except possession, which is
// already a percentage ("59.6").
export function formatSoccerStat(name, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "–");
  if (name === "possessionPct") return `${Math.round(n)}%`;
  if (/Pct$/.test(name)) return `${Math.round(n * 100)}%`;
  return String(n);
}

// A key event as one of the few kinds the timeline draws, or null for the rest
// (kick-off, half-time, delays…). Goals are ESPN's `scoringPlay`s.
export function classifyEvent(event) {
  const type = event?.type?.type || "";
  if (event?.scoringPlay) {
    if (type.includes("own-goal")) return "ownGoal";
    if (type.includes("penalty")) return "penaltyGoal";
    return "goal";
  }
  if (type.includes("penalty") && /miss|saved/.test(type)) return "penaltyMissed";
  if (type.includes("yellow-red") || type.includes("second-yellow")) return "red";
  if (type.includes("red-card")) return "red";
  if (type.includes("yellow-card")) return "yellow";
  if (type === "substitution") return "sub";
  return null;
}

// Timeline rows in match order: { id, kind, minute, side: "home" | "away",
// player, other } — `other` is the player who came off (substitution) or set
// the goal up. Shootout kicks are left out.
export function buildTimeline(keyEvents = [], homeTeamId) {
  return keyEvents
    .filter((event) => !event.shootout)
    .map((event) => {
      const kind = classifyEvent(event);
      if (!kind) return null;
      const [first, second] = (event.participants || []).map((p) => p.athlete?.displayName).filter(Boolean);
      return {
        id: event.id,
        kind,
        minute: event.clock?.displayValue || "",
        order: Number(event.clock?.value) || 0,
        side: String(event.team?.id) === String(homeTeamId) ? "home" : "away",
        player: first || "",
        other: second || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

// Both teams' values for each wanted stat: [{ name, home, away, homeValue,
// awayValue }], paired by name (the two teams' lists aren't guaranteed to
// line up) and skipping stats ESPN didn't send for either team.
export function pairStats(teams = [], names = SOCCER_STATS) {
  const [home, away] = teams;
  const valueOf = (team, name) => team?.statistics?.find((s) => s.name === name)?.displayValue;

  return names
    .map((name) => {
      const a = valueOf(home, name);
      const b = valueOf(away, name);
      if (a == null && b == null) return null;
      return {
        name,
        home: formatSoccerStat(name, a),
        away: formatSoccerStat(name, b),
        homeValue: Number(a) || 0,
        awayValue: Number(b) || 0,
      };
    })
    .filter(Boolean);
}

// One side's line-up: { formation, starters, bench }. Each player is { id,
// name, jersey, position, subbedIn, subbedOut }; starters keep ESPN's order
// (goalkeeper first, then by formation place).
export function buildLineup(roster) {
  if (!roster?.roster?.length) return null;
  const toPlayer = (entry) => ({
    id: entry.athlete?.id,
    name: entry.athlete?.displayName || entry.athlete?.fullName || "",
    jersey: entry.jersey ?? "",
    position: entry.position?.abbreviation || "",
    subbedIn: Boolean(entry.subbedIn),
    subbedOut: Boolean(entry.subbedOut),
    place: Number(entry.formationPlace) || 99,
  });

  const players = roster.roster.map(toPlayer);
  const starters = roster.roster.map((e, i) => (e.starter ? players[i] : null)).filter(Boolean);
  const bench = roster.roster.map((e, i) => (e.starter ? null : players[i])).filter(Boolean);

  return {
    formation: roster.formation || "",
    starters: starters.sort((a, b) => a.place - b.place),
    bench,
  };
}
