import { describe, expect, it } from "vitest";
import { applyConferenceFixes } from "./api";

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
