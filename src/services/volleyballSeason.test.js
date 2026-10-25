import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  getTeamSchedule: vi.fn(),
  getVolleyballBoxscore: vi.fn(),
}));

const api = await import("./api");
const { peekSeason, requestSeason } = await import("./volleyballSeason");

// Each test uses its own team id: the season store is shared module state.
let nextTeam = 1000;

function competition(id, date, teamId, opponentId, { completed = true, us = 3, them = 1 } = {}) {
  const mk = (tid, score) => ({
    homeAway: tid === teamId ? "home" : "away",
    team: { id: String(tid), displayName: `Team ${tid}`, abbreviation: `T${tid}` },
    score: { displayValue: String(score) },
  });
  return {
    id,
    date,
    status: { type: { completed } },
    competitors: [mk(teamId, us), mk(opponentId, them)],
  };
}

const event = (comp) => ({ competitions: [comp] });
const box = (name) => ({ teams: [{ players: [{ name }] }, { players: [{ name: "Opponent" }] }] });

describe("season store", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads finished matches newest first and publishes each one as it is read", async () => {
    const team = nextTeam++;
    const comps = [
      competition("m1", "2026-09-01T00:00Z", team, 1),
      competition("m2", "2026-09-08T00:00Z", team, 2),
      competition("m3", "2026-09-15T00:00Z", team, 3),
      competition("m4", "2026-09-22T00:00Z", team, 4, { completed: false }), // upcoming: skipped
    ];
    api.getTeamSchedule.mockResolvedValue(comps.map(event));
    api.getVolleyballBoxscore.mockImplementation(async (c) => box(`Player ${c.id}`));

    requestSeason("league", team);
    await vi.waitFor(() => expect(peekSeason("league", team).done).toBe(true));

    const state = peekSeason("league", team);
    expect(state.total).toBe(3);
    expect(state.matches.map((m) => m.id)).toEqual(["m3", "m2", "m1"]); // newest first
    expect(state.matches[0]).toMatchObject({ home: true, score: [3, 1], won: true });
    expect(state.matches[0].players).toEqual([{ name: "Player m3" }]);
    expect(state.loaded).toBe(3);
    expect(state.fetched).toBe(3);
  });

  it("only reads as many matches as asked for, then the rest when asked again", async () => {
    const team = nextTeam++;
    const comps = Array.from({ length: 8 }, (_, i) => competition(`m${i}`, `2026-09-${String(i + 1).padStart(2, "0")}T00:00Z`, team, 50 + i));
    api.getTeamSchedule.mockResolvedValue(comps.map(event));
    api.getVolleyballBoxscore.mockImplementation(async (c) => box(c.id));

    requestSeason("league", team, 3);
    await vi.waitFor(() => expect(peekSeason("league", team).loaded).toBe(3));
    expect(api.getVolleyballBoxscore).toHaveBeenCalledTimes(3);
    expect(peekSeason("league", team).done).toBe(false);
    // the three read are the newest three
    expect(peekSeason("league", team).matches.map((m) => m.id).sort()).toEqual(["m5", "m6", "m7"]);

    requestSeason("league", team); // now the whole season
    await vi.waitFor(() => expect(peekSeason("league", team).done).toBe(true));
    expect(api.getVolleyballBoxscore).toHaveBeenCalledTimes(8); // none read twice
    expect(api.getTeamSchedule).toHaveBeenCalledTimes(1);
  });

  it("leaves out matches NCAA.com has no box score for, and ones that fail", async () => {
    const team = nextTeam++;
    const comps = [
      competition("ok", "2026-09-03T00:00Z", team, 1),
      competition("none", "2026-09-02T00:00Z", team, 2),
      competition("boom", "2026-09-01T00:00Z", team, 3),
    ];
    api.getTeamSchedule.mockResolvedValue(comps.map(event));
    api.getVolleyballBoxscore.mockImplementation(async (c) => {
      if (c.id === "none") return null;
      if (c.id === "boom") throw new Error("HTTP 502");
      return box("Someone");
    });

    requestSeason("league", team);
    await vi.waitFor(() => expect(peekSeason("league", team).done).toBe(true));

    const state = peekSeason("league", team);
    expect(state.matches.map((m) => m.id)).toEqual(["ok"]);
    expect(state.fetched).toBe(3); // all three were attempted
    expect(state.error).toBe(false);
  });

  it("reports an error when the schedule can't be loaded, and starts over on the next request", async () => {
    const team = nextTeam++;
    api.getTeamSchedule.mockRejectedValueOnce(new Error("offline"));

    requestSeason("league", team);
    await vi.waitFor(() => expect(peekSeason("league", team).error).toBe(true));

    api.getTeamSchedule.mockResolvedValue([event(competition("m1", "2026-09-01T00:00Z", team, 1))]);
    api.getVolleyballBoxscore.mockResolvedValue(box("Back Online"));
    requestSeason("league", team);
    await vi.waitFor(() => expect(peekSeason("league", team).done).toBe(true));

    const state = peekSeason("league", team);
    expect(state.error).toBe(false);
    expect(state.matches).toHaveLength(1);
  });

  it("is done at once for a team with no finished matches", async () => {
    const team = nextTeam++;
    api.getTeamSchedule.mockResolvedValue([event(competition("m1", "2026-12-01T00:00Z", team, 1, { completed: false }))]);

    requestSeason("league", team);
    await vi.waitFor(() => expect(peekSeason("league", team).total).toBe(0));
    expect(peekSeason("league", team)).toMatchObject({ done: true, matches: [] });
  });

  it("never reads more than four matches at the same time", async () => {
    const team = nextTeam++;
    const comps = Array.from({ length: 12 }, (_, i) => competition(`m${i}`, `2026-09-${String(i + 1).padStart(2, "0")}T00:00Z`, team, 70 + i));
    api.getTeamSchedule.mockResolvedValue(comps.map(event));

    let current = 0;
    let max = 0;
    api.getVolleyballBoxscore.mockImplementation(async (c) => {
      current += 1;
      max = Math.max(max, current);
      await new Promise((resolve) => setTimeout(resolve, 5));
      current -= 1;
      return box(c.id);
    });

    requestSeason("league", team);
    await vi.waitFor(() => expect(peekSeason("league", team).done).toBe(true));
    expect(max).toBeLessThanOrEqual(4);
    expect(max).toBeGreaterThan(1);
  });
});
