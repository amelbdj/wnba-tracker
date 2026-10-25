import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchScore, normalize, rankBy, readRecent, rememberResult } from "./search";

describe("normalize", () => {
  it("ignores accents, case and punctuation", () => {
    expect(normalize("José  Álvarez")).toBe("jose alvarez");
    expect(normalize("St. John's")).toBe("st johns");
  });

  it("treats every apostrophe style the same, so Hawai'i is findable as hawaii", () => {
    for (const name of ["Hawai'i", "Hawai’i", "Hawai‘i", "Hawaiʻi"]) {
      expect(normalize(name)).toBe("hawaii");
    }
  });

  it("copes with empty input", () => {
    expect(normalize(undefined)).toBe("");
    expect(normalize("")).toBe("");
  });
});

describe("matchScore", () => {
  it("ranks whole name > start of name > start of a word > anywhere", () => {
    const exact = matchScore(["Utah"], "utah");
    const prefix = matchScore(["Utah State"], "utah");
    const word = matchScore(["Southern Utah"], "utah");
    const inside = matchScore(["Mutahar"], "utah");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(0);
  });

  it("matches a multi-word query when each word starts a word of the name", () => {
    expect(matchScore(["Ohio State Buckeyes"], "state ohio")).toBeGreaterThan(0);
    expect(matchScore(["Ohio State Buckeyes"], "ohio texas")).toBe(0);
  });

  it("takes the best score over several names", () => {
    // "NEB" is an exact match (100) even though the long name only starts with it (80).
    expect(matchScore(["Nebraska Cornhuskers", "NEB"], "neb")).toBe(100);
  });

  it("returns 0 for no match or an empty query", () => {
    expect(matchScore(["Nebraska"], "zzz")).toBe(0);
    expect(matchScore(["Nebraska"], "")).toBe(0);
  });
});

describe("rankBy", () => {
  const teams = [
    { name: "Southern Utah" },
    { name: "Utah" },
    { name: "Utah State" },
    { name: "Oregon" },
  ];

  it("orders by score, drops non-matches and caps the list", () => {
    const names = (list) => list.map((t) => t.name);
    expect(names(rankBy(teams, "utah", (t) => [t.name], 10))).toEqual(["Utah", "Utah State", "Southern Utah"]);
    expect(names(rankBy(teams, "utah", (t) => [t.name], 2))).toEqual(["Utah", "Utah State"]);
  });

  it("keeps the original order between equal scores", () => {
    const list = [{ name: "Utah A" }, { name: "Utah B" }];
    expect(rankBy(list, "utah", (t) => [t.name], 5).map((t) => t.name)).toEqual(["Utah A", "Utah B"]);
  });
});

describe("recent results", () => {
  let store;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    });
  });

  const result = (n) => ({ key: `t:${n}`, kind: "team", name: `Team ${n}`, sub: "", image: "", to: `/x/${n}` });

  it("remembers the newest first, without duplicates, up to six", () => {
    for (let n = 1; n <= 8; n++) rememberResult(result(n));
    rememberResult(result(5));
    const keys = readRecent().map((r) => r.key);
    expect(keys).toHaveLength(6);
    expect(keys[0]).toBe("t:5");
    expect(new Set(keys).size).toBe(6);
  });

  it("returns an empty list when storage holds junk or is unavailable", () => {
    store.set("frontrow:recent-search", "not json");
    expect(readRecent()).toEqual([]);
    vi.stubGlobal("localStorage", undefined);
    expect(readRecent()).toEqual([]);
    expect(() => rememberResult(result(1))).not.toThrow();
  });
});
