import { describe, expect, it } from "vitest";
import { applyConferenceFixes, sortEntries } from "./api";

const entry = (id, name, extra = {}) => ({
  team: { id: String(id), displayName: name },
  stats: [{ name: "playoffSeed", value: extra.seed ?? 99 }, { name: "winPercent", value: extra.pct ?? 0.5 }, { name: "wins", value: extra.wins ?? 10 }],
});
const group = (name, entries) => ({ name, entries });

describe("applyConferenceFixes", () => {
  const build = () => [
    group("Big Ten Conference", [entry(1, "Nebraska", { seed: 1 }), entry(2, "Penn State", { seed: 3 })]),
    group("Pac-12 Conference", [entry(10, "UCLA", { seed: 2 }), entry(11, "Boise State", { seed: 1 })]),
    group("West Coast Conference", [entry(20, "BYU", { seed: 1, pct: 0.94, wins: 16 })]),
  ];

  it("moves listed teams into the target conference and out of the old one", () => {
    const groups = applyConferenceFixes(build(), [{ conference: "Big Ten", teams: [10] }]);
    expect(groups[0].entries.map((e) => e.team.displayName)).toEqual(["Nebraska", "UCLA", "Penn State"]);
    expect(groups[1].entries.map((e) => e.team.displayName)).toEqual(["Boise State"]);
  });

  it("orders the target by win percentage when asked", () => {
    const groups = applyConferenceFixes(build(), [{ conference: "Big Ten", teams: [20], byRecord: true }]);
    expect(groups[0].entries[0].team.displayName).toBe("BYU");
    expect(groups[2].entries).toHaveLength(0);
  });

  it("does not duplicate a team that is already in the target", () => {
    const groups = applyConferenceFixes(build(), [{ conference: "Big Ten", teams: [1] }]);
    expect(groups[0].entries.filter((e) => e.team.id === "1")).toHaveLength(1);
  });

  it("ignores a fix whose conference isn't there, and leaves groups alone with no fixes", () => {
    const groups = applyConferenceFixes(build(), [{ conference: "Big 12", teams: [10] }]);
    expect(groups[1].entries).toHaveLength(2);
    expect(applyConferenceFixes(build())).toHaveLength(3);
  });
});

describe("sortEntries", () => {
  const team = (name, stats) => ({
    team: { id: name, displayName: name },
    stats: Object.entries(stats).map(([key, value]) => ({ name: key, value })),
  });
  const names = (entries) => entries.map((e) => e.team.displayName);

  // American Conference, volleyball: ESPN seeds Tulane (20-6, 6-2 in conference)
  // 51st because it came from another conference, and Creighton-type cases
  // where seeds disagree with the conference records.
  const american = [
    team("Tulsa", { playoffSeed: 2, leagueWinPercent: 0.75, winPercent: 0.741, wins: 20, losses: 7 }),
    team("Charlotte", { playoffSeed: 13, leagueWinPercent: 0.063, winPercent: 0.148, wins: 4, losses: 23 }),
    team("Tulane", { playoffSeed: 51, leagueWinPercent: 0.75, winPercent: 0.769, wins: 20, losses: 6 }),
    team("North Texas", { playoffSeed: 7, leagueWinPercent: 0.5, winPercent: 0.556, wins: 15, losses: 12 }),
  ];

  it("follows ESPN's seeds by default", () => {
    expect(names(sortEntries(american))).toEqual(["Tulsa", "North Texas", "Charlotte", "Tulane"]);
  });

  it("in record mode, orders by conference record, so a 51st seed can still lead", () => {
    expect(names(sortEntries(american, "record"))).toEqual(["Tulane", "Tulsa", "North Texas", "Charlotte"]);
  });

  it("breaks conference ties on the overall record, then wins, then fewer losses", () => {
    const tied = [
      team("B", { leagueWinPercent: 0.5, winPercent: 0.6, wins: 6, losses: 4 }),
      team("A", { leagueWinPercent: 0.5, winPercent: 0.7, wins: 7, losses: 3 }),
      team("D", { leagueWinPercent: 0.5, winPercent: 0.6, wins: 12, losses: 8 }),
      team("C", { leagueWinPercent: 0.5, winPercent: 0.6, wins: 12, losses: 7 }),
    ];
    expect(names(sortEntries(tied, "record"))).toEqual(["A", "C", "D", "B"]);
  });

  it("falls back to the overall record when conference play hasn't started", () => {
    const early = [
      team("Winless", { leagueWinPercent: 0, winPercent: 0, wins: 0, losses: 3 }),
      team("Unbeaten", { leagueWinPercent: 0, winPercent: 1, wins: 4, losses: 0 }),
      team("Mixed", { leagueWinPercent: 0, winPercent: 0.5, wins: 2, losses: 2 }),
      team("NoData", {}), // an entry with no stats at all
    ];
    const sorted = names(sortEntries(early, "record"));
    expect(sorted).toHaveLength(4); // the entry without stats doesn't break the sort
    expect(sorted.slice(0, 2)).toEqual(["Unbeaten", "Mixed"]);
  });

  it("does not change the input list", () => {
    const copy = [...american];
    sortEntries(american, "record");
    expect(american).toEqual(copy);
  });

  it("uses football's rank when there are no seeds, then the win percentage", () => {
    const table = [
      team("Third", { rank: 3, winPercent: 0.2 }),
      team("First", { rank: 1, winPercent: 0.1 }),
      team("Second", { rank: 2, winPercent: 0.9 }),
    ];
    expect(names(sortEntries(table))).toEqual(["First", "Second", "Third"]);
    expect(names(sortEntries([team("Low", { winPercent: 0.2 }), team("High", { winPercent: 0.8 })]))).toEqual(["High", "Low"]);
  });
});
