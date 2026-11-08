import { describe, expect, it } from "vitest";
import { buildSoccerRecent, buildSoccerStats, pickSplit } from "./soccerPlayer";

const fieldPlayer = {
  statistics: {
    names: ["starts", "foulsCommitted", "foulsSuffered", "yellowCards", "redCards", "totalGoals", "goalAssists", "totalShots", "shotsOnTarget", "offsides"],
    splits: [
      { displayName: "2026 Women's International Friendly", leagueSlug: "fifa.friendly.w", stats: ["6", "4", "4", "2", "0", "2", "2", "12", "7", "2"] },
      { displayName: "2026 NWSL", leagueSlug: "usa.nwsl", stats: ["29", "30", "47", "2", "0", "11", "8", "107", "38", "6"] },
    ],
  },
};

const keeper = {
  statistics: {
    names: ["starts", "foulsCommitted", "foulsSuffered", "yellowCards", "redCards", "totalGoals", "goalAssists", "totalShots", "shotsOnTarget", "offsides", "cleanSheet", "saves", "goalsConceded"],
    splits: [
      { displayName: "2026 NWSL Challenge Cup", leagueSlug: "usa.nwsl.cup", stats: ["1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "2"] },
      { displayName: "2026 NWSL", leagueSlug: "usa.nwsl", stats: ["9", "0", "2", "0", "0", "0", "0", "0", "0", "0", "1", "27", "12"] },
    ],
  },
};

describe("pickSplit", () => {
  it("prefers the totals of the league being looked at", () => {
    expect(pickSplit(fieldPlayer, "usa.nwsl").displayName).toBe("2026 NWSL");
    expect(pickSplit(fieldPlayer, "fifa.friendly.w").displayName).toBe("2026 Women's International Friendly");
  });

  it("falls back to the competition the player started most in", () => {
    expect(pickSplit(fieldPlayer, "eng.w.1").displayName).toBe("2026 NWSL");
  });

  it("is null without any totals", () => {
    expect(pickSplit({}, "usa.nwsl")).toBeNull();
    expect(pickSplit({ statistics: { names: [], splits: [] } }, "usa.nwsl")).toBeNull();
  });
});

describe("buildSoccerStats", () => {
  it("gives a field player's starts, goals, assists, shots and cards", () => {
    const stats = buildSoccerStats(fieldPlayer, "usa.nwsl");
    expect(stats.title).toBe("2026 NWSL");
    expect(stats.keeper).toBe(false);
    expect(stats.tiles).toEqual([
      { name: "starts", value: "29" },
      { name: "totalGoals", value: "11" },
      { name: "goalAssists", value: "8" },
      { name: "totalShots", value: "107" },
      { name: "shotsOnTarget", value: "38" },
      { name: "yellowCards", value: "2" },
      { name: "redCards", value: "0" },
    ]);
  });

  it("gives a goalkeeper saves, clean sheets and goals conceded instead", () => {
    const stats = buildSoccerStats(keeper, "usa.nwsl");
    expect(stats.keeper).toBe(true);
    expect(stats.tiles.map((t) => t.name)).toEqual(["starts", "saves", "cleanSheet", "goalsConceded", "yellowCards", "redCards"]);
    expect(stats.tiles.find((t) => t.name === "saves").value).toBe("27");
  });

  it("is null without data", () => {
    expect(buildSoccerStats(undefined, "usa.nwsl")).toBeNull();
  });
});

describe("buildSoccerRecent", () => {
  const overview = {
    gameLog: {
      events: {
        a: { gameDate: "2026-10-10T16:00:00.000+00:00", atVs: "vs", opponent: { id: "1", displayName: "Gotham FC" }, gameResult: "W", score: "1-0" },
        b: { gameDate: "2026-10-17T16:00:00.000+00:00", atVs: "@", opponent: { id: "2", displayName: "Utah Royals" }, gameResult: "T", score: "2-2" },
      },
      statistics: [
        {
          names: ["appearances", "totalGoals", "goalAssists", "totalShots", "shotsOnTarget", "foulsCommitted", "foulsSuffered", "offsides", "yellowCards", "redCards"],
          events: [
            { eventId: "a", stats: ["Started", "1", "0", "5", "1", "1", "1", "0", "0", "0"] },
            { eventId: "b", stats: ["Sub", "0", "2", "1", "0", "0", "0", "0", "1", "0"] },
            { eventId: "missing", stats: ["Started", "0", "0", "0", "0", "0", "0", "0", "0", "0"] },
          ],
        },
      ],
    },
  };

  it("lists the matches newest first with what happened in each", () => {
    const rows = buildSoccerRecent(overview);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({ atVs: "@", result: "D", started: false, goals: 0, assists: 2, yellow: 1 });
    expect(rows[1]).toMatchObject({ result: "W", started: true, goals: 1, opponent: { displayName: "Gotham FC" } });
  });

  it("copes with a missing log", () => {
    expect(buildSoccerRecent(undefined)).toEqual([]);
    expect(buildSoccerRecent({ gameLog: { statistics: [] } })).toEqual([]);
  });
});
