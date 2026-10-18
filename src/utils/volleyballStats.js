// NCAA volleyball stat categories, grouped into families so the page can offer
// "Kills" with a per-set / total toggle instead of 16 separate chips. Ids are
// NCAA.com's own stat ids (see api/ncaa/_lib/volleyball.js for the allowlist);
// `primary` is the column of each leaderboard that the ranking is based on.
export const VOLLEYBALL_STAT_FAMILIES = [
  { key: "kills", icon: "fa-solid fa-bolt", perSet: { id: 2, primary: "Per Set" }, total: { id: 879, primary: "Kills" } },
  { key: "hitting", icon: "fa-solid fa-percent", perSet: { id: 1, primary: "Pct." } },
  { key: "assists", icon: "fa-solid fa-people-arrows", perSet: { id: 3, primary: "Per Set" }, total: { id: 880, primary: "Assists" } },
  { key: "aces", icon: "fa-solid fa-bullseye", perSet: { id: 42, primary: "Per Set" }, total: { id: 883, primary: "Aces" } },
  { key: "blocks", icon: "fa-solid fa-shield-halved", perSet: { id: 43, primary: "Per Set" }, total: { id: 887, primary: "TB" } },
  { key: "digs", icon: "fa-solid fa-hand", perSet: { id: 44, primary: "Per Set" }, total: { id: 885, primary: "Digs" } },
  { key: "points", icon: "fa-solid fa-star", perSet: { id: 552, primary: "Per Set" }, total: { id: 553, primary: "Pts" } },
  { key: "attacks", icon: "fa-solid fa-crosshairs", perSet: { id: 890, primary: "Per Set" }, total: { id: 889, primary: "Total Attacks" } },
  { key: "tripleDoubles", icon: "fa-solid fa-trophy", total: { id: 928, primary: "Trpl Dbl" } },
];

// Row fields that identify the player rather than describe a stat; everything
// else on a row is a stat column and is shown as-is.
export const IDENTITY_FIELDS = new Set(["Rank", "Name", "Team", "Cl", "Height", "Position"]);

// NCAA's column labels -> translation keys (stats.volleyball.col.*).
export const COLUMN_KEYS = {
  S: "sets",
  MP: "matches",
  "Per Set": "perSet",
  "Pct.": "pct",
  Kills: "kills",
  Errors: "errors",
  "Total Attacks": "attacks",
  Aces: "aces",
  Assists: "assists",
  Digs: "digs",
  "Block Solos": "blockSolos",
  "Block Assists": "blockAssists",
  Total: "blocks",
  TB: "blocks",
  Pts: "points",
  "Trpl Dbl": "tripleDoubles",
};

// "Friday, October 16, 2026 6:10 am - Through games Thursday, October 15, 2026"
// -> the date the numbers are current through, or null.
export function parseThroughDate(updated) {
  const match = /through games\s+(.+)$/i.exec(updated || "");
  const date = match ? new Date(match[1]) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
