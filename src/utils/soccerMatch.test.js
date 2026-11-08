import { describe, expect, it } from "vitest";
import { buildLineup, buildTimeline, classifyEvent, formatSoccerStat, pairStats } from "./soccerMatch";

const event = (type, extra = {}) => ({
  id: String(Math.random()),
  type: { type, text: type },
  clock: { displayValue: "10'", value: 600 },
  team: { id: "1" },
  participants: [{ athlete: { displayName: "Ana" } }],
  scoringPlay: false,
  shootout: false,
  ...extra,
});

describe("classifyEvent", () => {
  it("recognises goals by ESPN's scoringPlay flag, whatever the kind of goal", () => {
    expect(classifyEvent(event("goal", { scoringPlay: true }))).toBe("goal");
    expect(classifyEvent(event("goal---header", { scoringPlay: true }))).toBe("goal");
    expect(classifyEvent(event("penalty---scored", { scoringPlay: true }))).toBe("penaltyGoal");
    expect(classifyEvent(event("own-goal", { scoringPlay: true }))).toBe("ownGoal");
  });

  it("recognises cards, substitutions and missed penalties", () => {
    expect(classifyEvent(event("yellow-card"))).toBe("yellow");
    expect(classifyEvent(event("red-card"))).toBe("red");
    expect(classifyEvent(event("yellow-red-card"))).toBe("red");
    expect(classifyEvent(event("substitution"))).toBe("sub");
    expect(classifyEvent(event("penalty---saved"))).toBe("penaltyMissed");
  });

  it("ignores the rest of the match's bookkeeping", () => {
    for (const type of ["kickoff", "halftime", "start-delay", "end-delay", "start-2nd-half", "end-regular-time", "start-shootout"]) {
      expect(classifyEvent(event(type)), type).toBeNull();
    }
    expect(classifyEvent(undefined)).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("keeps the events worth drawing, in match order, on the side of the team they belong to", () => {
    const rows = buildTimeline(
      [
        event("substitution", { clock: { displayValue: "71'", value: 4254 }, team: { id: "2" }, participants: [{ athlete: { displayName: "In" } }, { athlete: { displayName: "Out" } }] }),
        event("kickoff", { clock: { displayValue: "1'", value: 0 } }),
        event("goal", { scoringPlay: true, clock: { displayValue: "5'", value: 300 }, team: { id: "1" }, participants: [{ athlete: { displayName: "Scorer" } }, { athlete: { displayName: "Assist" } }] }),
        event("yellow-card", { clock: { displayValue: "21'", value: 1260 }, team: { id: "2" } }),
      ],
      "1",
    );
    expect(rows.map((r) => [r.minute, r.kind, r.side])).toEqual([
      ["5'", "goal", "home"],
      ["21'", "yellow", "away"],
      ["71'", "sub", "away"],
    ]);
    expect(rows[0]).toMatchObject({ player: "Scorer", other: "Assist" });
    expect(rows[2]).toMatchObject({ player: "In", other: "Out" });
  });

  it("leaves penalty-shootout kicks out and copes with no events", () => {
    expect(buildTimeline([event("goal", { scoringPlay: true, shootout: true })], "1")).toEqual([]);
    expect(buildTimeline(undefined, "1")).toEqual([]);
  });
});

describe("formatSoccerStat / pairStats", () => {
  it("shows possession as a percentage and other rates as the percentage of their fraction", () => {
    expect(formatSoccerStat("possessionPct", "59.6")).toBe("60%");
    expect(formatSoccerStat("passPct", "0.8")).toBe("80%");
    expect(formatSoccerStat("totalShots", "20")).toBe("20");
    expect(formatSoccerStat("totalShots", undefined)).toBe("–");
  });

  const team = (stats) => ({ statistics: Object.entries(stats).map(([name, displayValue]) => ({ name, displayValue })) });

  it("pairs the wanted stats by name, in display order, skipping ones neither team has", () => {
    const home = team({ yellowCards: "1", possessionPct: "60", totalShots: "20", offsides: "2" });
    const away = team({ totalShots: "8", possessionPct: "40", yellowCards: "3" }); // no offsides
    const pairs = pairStats([home, away]);
    expect(pairs.map((p) => p.name)).toEqual(["possessionPct", "totalShots", "offsides", "yellowCards"]);
    expect(pairs[0]).toMatchObject({ home: "60%", away: "40%", homeValue: 60, awayValue: 40 });
    expect(pairs[2]).toMatchObject({ home: "2", away: "–" }); // one side missing
  });

  it("returns nothing for a match with no statistics yet", () => {
    expect(pairStats([])).toEqual([]);
    expect(pairStats([team({}), team({})])).toEqual([]);
  });
});

describe("buildLineup", () => {
  const entry = (id, name, jersey, pos, starter, place, extra = {}) => ({
    athlete: { id, displayName: name },
    jersey,
    position: { abbreviation: pos },
    starter,
    formationPlace: place,
    subbedIn: false,
    subbedOut: false,
    ...extra,
  });

  it("splits starters from the bench and orders starters by their place in the formation", () => {
    const lineup = buildLineup({
      formation: "4-4-2",
      roster: [
        entry("3", "Defender", "5", "CD", true, "3", { subbedOut: true }),
        entry("1", "Keeper", "1", "G", true, "1"),
        entry("9", "Sub", "20", "F", false, undefined, { subbedIn: true }),
        entry("2", "Winger", "7", "RM", true, "2"),
      ],
    });
    expect(lineup.formation).toBe("4-4-2");
    expect(lineup.starters.map((p) => p.name)).toEqual(["Keeper", "Winger", "Defender"]);
    expect(lineup.starters[2]).toMatchObject({ subbedOut: true, jersey: "5", position: "CD" });
    expect(lineup.bench).toHaveLength(1);
    expect(lineup.bench[0]).toMatchObject({ name: "Sub", subbedIn: true });
  });

  it("is null when ESPN has no line-up", () => {
    expect(buildLineup(undefined)).toBeNull();
    expect(buildLineup({ roster: [] })).toBeNull();
  });
});
