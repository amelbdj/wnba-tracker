import { describe, expect, it } from "vitest";
import {
  formatDateParam,
  getFeaturedGame,
  getGameStatus,
  getLiveDetail,
  getPeriodScores,
  getPollInterval,
  getSetScores,
} from "./games";

const t = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

const game = (state, extra = {}) => ({
  id: String(Math.random()),
  date: "2026-10-24T20:00:00Z",
  status: { type: { state, completed: state === "post", ...extra } },
});

describe("formatDateParam", () => {
  it("files a game under its US Eastern day, not its UTC day", () => {
    // 01:00 UTC on the 25th is 9pm on the 24th in New York.
    expect(formatDateParam(new Date("2026-10-25T01:00:00Z"))).toBe("20261024");
    expect(formatDateParam(new Date("2026-10-25T05:00:00Z"))).toBe("20261025");
  });
});

describe("getPollInterval", () => {
  const now = new Date("2026-10-24T12:00:00Z").getTime();
  const pre = (hoursAway) => ({
    ...game("pre"),
    date: new Date(now + hoursAway * 3600 * 1000).toISOString(),
  });

  it("polls fast while a game is live", () => {
    expect(getPollInterval([game("post"), game("in")], now)).toBe(20_000);
  });

  it("polls fast when a game is about to start, slowly when it is hours away", () => {
    expect(getPollInterval([pre(0.25)], now)).toBe(20_000);
    expect(getPollInterval([pre(3)], now)).toBe(60_000);
  });

  it("does not poll when nothing is happening soon", () => {
    expect(getPollInterval([pre(10)], now)).toBeNull();
    expect(getPollInterval([game("post")], now)).toBeNull();
    expect(getPollInterval([], now)).toBeNull();
    expect(getPollInterval(undefined, now)).toBeNull();
  });
});

describe("getFeaturedGame", () => {
  it("prefers a live game, then the next upcoming one, then a result", () => {
    const live = game("in");
    const early = { ...game("pre"), date: "2026-10-24T18:00:00Z" };
    const late = { ...game("pre"), date: "2026-10-24T23:00:00Z" };
    const done = game("post");
    expect(getFeaturedGame([done, late, early, live])).toBe(live);
    expect(getFeaturedGame([done, late, early])).toBe(early);
    expect(getFeaturedGame([done])).toBe(done);
    expect(getFeaturedGame([])).toBeNull();
  });

  it("does not present a postponed game as the latest result", () => {
    const postponed = game("post", { completed: false, name: "STATUS_POSTPONED" });
    const done = game("post");
    expect(getFeaturedGame([postponed, done])).toBe(done);
  });
});

describe("getGameStatus", () => {
  it("recognises live, final and upcoming games", () => {
    expect(getGameStatus(game("in"), t)).toMatchObject({ isLive: true, isFinal: false });
    expect(getGameStatus(game("post"), t)).toMatchObject({ isFinal: true, label: "game.final" });
    expect(getGameStatus(game("pre", { name: "STATUS_SCHEDULED" }), t)).toMatchObject({
      isLive: false,
      isFinal: false,
    });
  });

  it("does not call a postponed, canceled or suspended game final", () => {
    for (const [name, key] of [
      ["STATUS_POSTPONED", "postponed"],
      ["STATUS_CANCELED", "canceled"],
      ["STATUS_SUSPENDED", "suspended"],
    ]) {
      const status = getGameStatus(game("post", { completed: false, name, description: name }), t);
      expect(status.isFinal).toBe(false);
      expect(status.label).toContain(`game.status.${key}`);
    }
  });
});

describe("getLiveDetail", () => {
  const live = (status) => ({ status });

  it("shows the quarter and clock for basketball, the set for volleyball", () => {
    expect(getLiveDetail(live({ period: 3, displayClock: "4:32", type: {} }), "basketball", t)).toBe("Q3 · 4:32");
    expect(getLiveDetail(live({ period: 3, type: {} }), "volleyball", t)).toContain("game.set");
  });

  it("names breaks in play in the right sport's terms", () => {
    const end = live({ period: 3, type: { name: "STATUS_END_PERIOD" } });
    expect(getLiveDetail(end, "basketball", t)).toContain("game.status.endPeriod");
    expect(getLiveDetail(end, "volleyball", t)).toContain("game.status.endSet");
    expect(getLiveDetail(live({ type: { name: "STATUS_HALFTIME" } }), "basketball", t)).toBe(
      "game.status.halftime",
    );
  });
});

describe("period and set scores", () => {
  const line = (...values) => values.map((v) => ({ displayValue: String(v) }));

  it("labels quarters Q1-Q4 and then OT, OT2…", () => {
    const comp = { competitors: [{ linescores: line(18, 24, 24, 25, 6, 4) }, { linescores: line(22, 20, 19, 24, 6, 5) }] };
    expect(getPeriodScores(comp).map((p) => p.label)).toEqual(["Q1", "Q2", "Q3", "Q4", "OT", "OT2"]);
    expect(getPeriodScores(comp)[0].scores).toEqual([18, 22]);
  });

  it("returns nothing when there are no line scores", () => {
    expect(getPeriodScores({ competitors: [{}, {}] })).toEqual([]);
  });

  it("reads volleyball sets as point pairs", () => {
    const comp = { competitors: [{ linescores: [{ value: 25 }, { value: 21 }] }, { linescores: [{ value: 20 }, { value: 25 }] }] };
    expect(getSetScores(comp)).toEqual([[25, 20], [21, 25]]);
  });
});
