import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOptedOut, setOptedOut, track } from "./analytics";

// The tests run in Node: give them just enough of a browser.
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("track", () => {
  it("does nothing when the Umami script isn't there", () => {
    expect(() => track("search_opened")).not.toThrow();
  });

  it("forwards the event name and data to Umami", () => {
    const umami = { track: vi.fn() };
    vi.stubGlobal("umami", umami);
    track("favorite_added", { league: "wnba" });
    expect(umami.track).toHaveBeenCalledWith("favorite_added", { league: "wnba" });
  });

  it("sends nothing once the visitor has opted out", () => {
    const umami = { track: vi.fn() };
    vi.stubGlobal("umami", umami);
    setOptedOut(true);
    track("search_opened");
    expect(umami.track).not.toHaveBeenCalled();
  });

  it("never lets a failing script break the page", () => {
    vi.stubGlobal("umami", {
      track: () => {
        throw new Error("boom");
      },
    });
    expect(() => track("search_opened")).not.toThrow();
  });
});

describe("opt-out", () => {
  it("is off by default, on after setOptedOut(true), off again after false", () => {
    expect(isOptedOut()).toBe(false);
    setOptedOut(true);
    expect(isOptedOut()).toBe(true);
    setOptedOut(false);
    expect(isOptedOut()).toBe(false);
  });

  it("uses the key Umami's own script reads", () => {
    setOptedOut(true);
    expect(localStorage.getItem("umami.disabled")).toBeTruthy();
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(isOptedOut()).toBe(false);
    expect(() => setOptedOut(true)).not.toThrow();
  });
});
