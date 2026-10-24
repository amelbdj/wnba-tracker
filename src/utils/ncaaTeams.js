// NCAA.com spells team names its own way ("Eastern Wash.", "St. John's (NY)",
// "Miami (FL)") and gives no team ids, while the rest of the app knows teams by
// ESPN's ids/logos. This matches the two by normalised name so a player's row
// can show the right logo and link to the team page.

// Abbreviations NCAA.com uses for states and common words.
const ABBREVIATIONS = {
  ala: "alabama", ariz: "arizona", ark: "arkansas", calif: "california", colo: "colorado",
  conn: "connecticut", del: "delaware", fla: "florida", ga: "georgia", ill: "illinois",
  ind: "indiana", kan: "kansas", ky: "kentucky", la: "louisiana", mass: "massachusetts",
  md: "maryland", mich: "michigan", minn: "minnesota", miss: "mississippi", mo: "missouri",
  neb: "nebraska", nev: "nevada", okla: "oklahoma", ore: "oregon", pa: "pennsylvania",
  tenn: "tennessee", tex: "texas", va: "virginia", wash: "washington", wis: "wisconsin",
  wyo: "wyoming", ncsu: "nc state", fdu: "fairleigh dickinson", uconn: "connecticut",
  intl: "international", pfw: "purdue fort wayne", caro: "carolina", val: "valley",
};

// Names that no amount of normalising connects (keys are normalised NCAA
// names, values are normalised ESPN names). Only add an entry after checking
// both sides — a wrong alias silently attaches players to the wrong team.
const ALIASES = {
  "central connecticut state": "central connecticut",
  "usc upstate": "south carolina upstate",
  utrgv: "ut rio grande valley",
  "csu bakersfield": "cal state bakersfield",
  "southern california": "usc",
  alcorn: "alcorn state",
  "col charleston": "charleston",
  "a and m corpus christi": "texas a and m corpus christi",
  "mississippi valley": "mississippi valley state",
  "army west point": "army",
  "southern u": "southern",
  "southern n o": "southern new orleans",
};

// Words that distinguish the same school's other campuses/sports.
const DROPPED_WORDS = new Set(["university", "the", "of", "at"]);

// `keepTag` turns "(OH)" into a word instead of dropping it, so "Miami (OH)"
// stays distinct from "Miami (FL)" when both spellings are available.
export function normalizeTeamName(name, { keepTag = false } = {}) {
  return String(name || "")
    .toLowerCase()
    .replace(/\(([a-z]{2})\)/g, keepTag ? " $1 " : " ") // "(NY)", "(FL)", "(CA)" state tags
    .replace(/&/g, " and ")
    .replace(/[.'’‘ʻ]/g, "") // apostrophes and the Hawaiian okina ("Hawai'i")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ABBREVIATIONS[word] || word)
    .filter((word) => !DROPPED_WORDS.has(word))
    // "st" is "state" except at the start ("St John's", "St Thomas").
    .map((word, i) => (word === "st" && i > 0 ? "state" : word))
    .join(" ");
}

// Several keys per ESPN team (short name, location, full name, abbreviation),
// because NCAA.com is inconsistent about which form it uses.
export function buildTeamIndex(teams) {
  const index = new Map();
  // ESPN spells a state tag only to tell two schools apart ("Miami (OH)"),
  // so those names are indexed with the tag kept — never as plain "miami",
  // which belongs to the other school.
  const add = (key, team) => {
    const k = normalizeTeamName(key, { keepTag: true });
    if (k && !index.has(k)) index.set(k, team);
  };
  for (const team of teams) {
    add(team.shortDisplayName, team);
    add(team.location, team);
    add(team.displayName, team);
    if (team.abbreviation) add(team.abbreviation, team);
  }
  return index;
}

export function findTeam(index, ncaaName) {
  // Exact spelling first ("miami oh"), then without the tag ("miami").
  const tagged = normalizeTeamName(ncaaName, { keepTag: true });
  const plain = normalizeTeamName(ncaaName);
  const alias = ALIASES[plain];
  return (
    index.get(tagged) || index.get(plain) || (alias && index.get(normalizeTeamName(alias))) || null
  );
}

// ---- Matching a match ESPN knows to the same match on NCAA.com ------------
// The two sources share no game id, so a match is found by its two teams on
// the same (US) day. Each side is compared through every name form either
// source offers, normalised and alias-resolved like findTeam() does.

// `strict` keeps only the spelling with the state tag ("columbia sc" for
// "Columbia (SC)"), which is how two schools sharing a name are told apart.
function nameKeys(name, strict) {
  const keys = new Set();
  const forms = strict
    ? [normalizeTeamName(name, { keepTag: true })]
    : [normalizeTeamName(name, { keepTag: true }), normalizeTeamName(name)];
  for (const key of forms) {
    if (!key) continue;
    keys.add(key);
    if (ALIASES[key]) keys.add(normalizeTeamName(ALIASES[key], { keepTag: true }));
  }
  return keys;
}

function keysOf(names, strict = false) {
  const all = new Set();
  for (const name of names.filter(Boolean)) nameKeys(name, strict).forEach((k) => all.add(k));
  return all;
}

const intersects = (a, b) => [...a].some((k) => b.has(k));

// `games` are NCAA scoreboard games (the inner `game` objects); `teamA`/`teamB`
// are the two ESPN team objects. Returns { game, aIsHome } for the one game
// both teams are in, or null — also when several would fit, since attaching
// someone else's box score to a match is worse than showing none.
export function findNcaaGame(games, teamA, teamB) {
  const namesOf = (team) => [team.shortDisplayName, team.location, team.displayName, team.abbreviation];
  const gameNames = (side) => [side?.names?.short, side?.names?.full, side?.names?.seo?.replace(/-/g, " "), side?.names?.char6];

  const search = (strict) => {
    const a = keysOf(namesOf(teamA), strict);
    const b = keysOf(namesOf(teamB), strict);
    const hits = [];
    for (const game of games) {
      const home = keysOf(gameNames(game.home), strict);
      const away = keysOf(gameNames(game.away), strict);
      if (intersects(a, home) && intersects(b, away)) hits.push({ game, aIsHome: true });
      else if (intersects(a, away) && intersects(b, home)) hits.push({ game, aIsHome: false });
    }
    return hits;
  };

  // "Columbia" and "Columbia (SC)" both read as "columbia" once the state tag
  // is dropped, so an ambiguous match is retried on the tagged spellings only.
  const hits = search(false);
  const resolved = hits.length > 1 ? search(true) : hits;
  return resolved.length === 1 ? resolved[0] : null;
}
