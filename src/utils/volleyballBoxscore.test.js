import { describe, expect, it } from "vitest";
import {
  buildMatchBoxscore,
  buildPlayerSeason,
  buildRoster,
  buildTeamBoxscore,
  formatHitting,
  playerSlug,
} from "./volleyballBoxscore";

// NCAA sends every number as a string.
const raw = (firstName, lastName, stats = {}) => ({
  firstName,
  lastName,
  position: "OH",
  number: "7",
  starter: false,
  participated: true,
  gamesPlayed: "3",
  points: "0",
  kills: "0",
  attackErrors: "0",
  attackAttempts: "0",
  assists: "0",
  serviceAces: "0",
  serviceErrors: "0",
  digs: "0",
  receptionErrors: "0",
  blockSolos: "0",
  blockAssists: "0",
  totalBlocks: "0",
  ...stats,
});

describe("formatHitting", () => {
  it("is (kills - errors) / attempts to three decimals, without a leading zero", () => {
    expect(formatHitting(16, 10, 52)).toBe(".115");
    expect(formatHitting(10, 0, 20)).toBe(".500");
    expect(formatHitting(5, 8, 20)).toBe("-.150");
  });

  it("is .000 when there were no attacks", () => {
    expect(formatHitting(0, 0, 0)).toBe(".000");
  });
});

describe("buildTeamBoxscore", () => {
  const players = [
    raw("Ana", "Bench"), // never played
    raw("Bea", "Libero", { number: "1", digs: "12" }), // no points, but played
    raw("Cy", "Starter", { number: "5", starter: true }), // starter, no stats yet
    raw("Di", "Hitter", { number: "9", points: "15.5", kills: "14", attackErrors: "4", attackAttempts: "40", assists: "1" }),
    raw("Ed", "Scorer", { number: "3", points: "10", kills: "9", attackErrors: "2", attackAttempts: "20", totalBlocks: "2" }),
  ];
  const { players: rows, totals } = buildTeamBoxscore(players);

  it("keeps only players who took part (a starter or anyone with a stat)", () => {
    // best scorers first; the two without points are ordered by jersey number
    expect(rows.map((p) => p.name)).toEqual(["Di Hitter", "Ed Scorer", "Bea Libero", "Cy Starter"]);
    expect(rows).toHaveLength(4);
  });

  it("turns NCAA's strings into numbers", () => {
    expect(rows[0]).toMatchObject({ points: 15.5, kills: 14, errors: 4, attempts: 40, number: "9" });
  });

  it("totals the team and recomputes its hitting percentage", () => {
    expect(totals).toMatchObject({ points: 25.5, kills: 23, errors: 6, attempts: 60, assists: 1, digs: 12, blocks: 2 });
    expect(totals.pct).toBe(".283");
  });
});

describe("buildMatchBoxscore", () => {
  const box = {
    status: "F",
    teams: [
      { teamId: 1, isHome: true },
      { teamId: 2, isHome: false },
    ],
    teamBoxscore: [
      { teamId: 1, playerStats: [raw("Home", "Player", { points: "5" })] },
      { teamId: 2, playerStats: [raw("Away", "Player", { points: "7" })] },
    ],
  };

  it("lines the two teams up with ESPN's order", () => {
    const a = buildMatchBoxscore(box, true); // ESPN's first team is NCAA's home team
    expect(a.teams[0].players[0].name).toBe("Home Player");
    const b = buildMatchBoxscore(box, false);
    expect(b.teams[0].players[0].name).toBe("Away Player");
    expect(b.teams[1].players[0].name).toBe("Home Player");
  });

  it("flags a finished match", () => {
    expect(buildMatchBoxscore(box, true).isFinal).toBe(true);
    expect(buildMatchBoxscore({ ...box, status: "I" }, true).isFinal).toBe(false);
  });
});

describe("playerSlug", () => {
  it("is the same for spellings that differ in case, accents or punctuation", () => {
    expect(playerSlug("Gabby DiVita")).toBe("gabby-divita");
    expect(playerSlug("Gabby Divita")).toBe("gabby-divita");
    expect(playerSlug("Mélanie O'Brien-Smith")).toBe("melanie-o-brien-smith");
  });
});

describe("buildRoster", () => {
  const match = (...players) => ({ players });
  const p = (name, number, position = "OH") => ({ name, number, position });

  it("lists everyone seen, newest spelling and number first, most-used players first", () => {
    const roster = buildRoster([
      match(p("Gabby DiVita", "23"), p("Zoe Lee", "4")),
      match(p("Gabby Divita", "22"), p("Amy Ray", "1")),
      match(p("Gabby DiVita", "22")),
    ]);
    expect(roster.map((r) => r.name)).toEqual(["Gabby DiVita", "Amy Ray", "Zoe Lee"]);
    expect(roster[0]).toMatchObject({ name: "Gabby DiVita", number: "23", matches: 3, slug: "gabby-divita" });
    expect(roster).toHaveLength(3);
  });

  it("breaks ties on jersey number", () => {
    const roster = buildRoster([match(p("B Two", "2"), p("A Nine", "9"))]);
    expect(roster.map((r) => r.number)).toEqual(["2", "9"]);
  });
});

describe("buildPlayerSeason", () => {
  const line = (points, kills, sets = 3) => ({
    name: "Di Hitter", number: "9", position: "OH", sets, points, kills, errors: 1, attempts: 10, assists: 0, aces: 1, digs: 4, blocks: 0,
  });
  const matches = [
    { id: "2", players: [line(10, 8)] },
    { id: "1", players: [line(6, 5, 4)] },
    { id: "0", players: [] }, // she didn't play
  ];
  const season = buildPlayerSeason(matches, "di-hitter");

  it("sums the matches she played in", () => {
    expect(season.games).toHaveLength(2);
    expect(season.totals).toMatchObject({ matches: 2, sets: 7, points: 16, kills: 13, errors: 2, attempts: 20, aces: 2, digs: 8 });
    expect(season.totals.pct).toBe(".550");
  });

  it("computes per-set averages", () => {
    expect(season.perSet.points).toBe((16 / 7).toFixed(2));
    expect(season.perSet.kills).toBe((13 / 7).toFixed(2));
  });

  it("is null for a player who appears in no match", () => {
    expect(buildPlayerSeason(matches, "nobody")).toBeNull();
  });
});
