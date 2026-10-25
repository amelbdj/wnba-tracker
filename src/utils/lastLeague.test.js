import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLastLeague, rememberLeague } from "./lastLeague";

describe("last league", () => {
  let store;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    });
  });

  it("falls back to the default league when nothing was stored", () => {
    expect(getLastLeague()).toBe("wnba");
  });

  it("returns the league that was remembered", () => {
    rememberLeague("womens-college-volleyball");
    expect(getLastLeague()).toBe("womens-college-volleyball");
  });

  it("ignores a stored value that is not a known league", () => {
    store.set("frontrow:last-league", "bogus");
    expect(getLastLeague()).toBe("wnba");
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(getLastLeague()).toBe("wnba");
    expect(() => rememberLeague("wnba")).not.toThrow();
  });
});
