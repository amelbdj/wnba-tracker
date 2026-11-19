import { describe, expect, it } from "vitest";
import { ESPN_HOSTS, ESPN_KINDS, resolveEspnRequest } from "./espnRoutes";

const resolve = (input) => resolveEspnRequest(input);

describe("resolveEspnRequest — the URLs it builds", () => {
  it("builds each kind from the league's sport", () => {
    expect(resolve({ kind: "scoreboard", league: "wnba", dates: "20260921" }).url).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=20260921",
    );
    expect(resolve({ kind: "summary", league: "womens-college-volleyball", event: "401820327" }).url).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/summary?event=401820327",
    );
    expect(resolve({ kind: "team", league: "wnba", id: 14 }).url).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/14",
    );
    expect(resolve({ kind: "roster", league: "wnba", id: "14" }).url).toMatch(/\/teams\/14\/roster$/);
    expect(resolve({ kind: "schedule", league: "wnba", id: "14" }).url).toMatch(/\/teams\/14\/schedule$/);
    expect(resolve({ kind: "statistics", league: "wnba" }).url).toMatch(/\/wnba\/statistics$/);
    expect(resolve({ kind: "standings", league: "wnba" }).url).toBe(
      "https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings",
    );
    expect(resolve({ kind: "standings", league: "womens-college-volleyball", level: 3 }).url).toMatch(
      /\/volleyball\/womens-college-volleyball\/standings\?level=3$/,
    );
    expect(resolve({ kind: "athlete", league: "wnba", id: "4433403" }).url).toBe(
      "https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/athletes/4433403",
    );
    expect(resolve({ kind: "athleteOverview", league: "wnba", id: "1" }).url).toMatch(/athletes\/1\/overview$/);
    expect(resolve({ kind: "athleteGameLog", league: "wnba", id: "1" }).url).toMatch(/athletes\/1\/gamelog$/);
  });

  it("uses the football sport segment for football leagues", () => {
    expect(resolve({ kind: "standings", league: "fra.w.1" }).url).toBe(
      "https://site.api.espn.com/apis/v2/sports/soccer/fra.w.1/standings",
    );
  });

  it("encodes the search text and defaults the limit", () => {
    expect(resolve({ kind: "search", query: "  caitlin clark  " }).url).toBe(
      "https://site.api.espn.com/apis/search/v2?query=caitlin%20clark&type=player&limit=20",
    );
    expect(resolve({ kind: "search", query: "a&type=team#x", limit: 30 }).url).toBe(
      "https://site.api.espn.com/apis/search/v2?query=a%26type%3Dteam%23x&type=player&limit=30",
    );
  });

  it("only ever reaches ESPN's own hosts, over https", () => {
    const sample = {
      scoreboard: { league: "wnba", dates: "20260921" },
      summary: { league: "wnba", event: "1" },
      team: { league: "wnba", id: "1" },
      roster: { league: "wnba", id: "1" },
      schedule: { league: "wnba", id: "1" },
      statistics: { league: "wnba" },
      standings: { league: "wnba" },
      athlete: { league: "wnba", id: "1" },
      athleteOverview: { league: "wnba", id: "1" },
      athleteGameLog: { league: "wnba", id: "1" },
      search: { query: "clark" },
    };
    expect(Object.keys(sample).sort()).toEqual(Object.keys(ESPN_KINDS).sort());
    for (const [kind, fields] of Object.entries(sample)) {
      const { url } = resolve({ kind, ...fields });
      const parsed = new URL(url);
      expect(parsed.protocol, kind).toBe("https:");
      expect(ESPN_HOSTS, kind).toContain(parsed.hostname);
    }
  });
});

describe("resolveEspnRequest — the canonical query", () => {
  it("lists the fields in alphabetical order, whatever order they came in", () => {
    const a = resolve({ league: "wnba", kind: "scoreboard", dates: "20260921" });
    const b = resolve({ dates: "20260921", kind: "scoreboard", league: "wnba" });
    expect(a.query).toBe("dates=20260921&kind=scoreboard&league=wnba");
    expect(b.query).toBe(a.query);
  });

  it("leaves out fields that were not given", () => {
    expect(resolve({ kind: "standings", league: "wnba", level: undefined }).query).toBe("kind=standings&league=wnba");
  });
});

describe("resolveEspnRequest — what it refuses", () => {
  it.each([
    ["no input", undefined],
    ["an unknown kind", { kind: "teams", league: "wnba" }],
    ["a kind that is an object property", { kind: "constructor", league: "wnba" }],
    ["a prototype key", { kind: "__proto__", league: "wnba" }],
    ["no kind", { league: "wnba" }],
    ["an unknown league", { kind: "standings", league: "nba" }],
    ["a league that tries to climb out of the path", { kind: "standings", league: "../../x" }],
    ["a missing league", { kind: "standings" }],
    ["a missing id", { kind: "team", league: "wnba" }],
    ["a non-numeric id", { kind: "team", league: "wnba", id: "14abc" }],
    ["an id with a path in it", { kind: "team", league: "wnba", id: "14/roster" }],
    ["an id with a query in it", { kind: "team", league: "wnba", id: "14?x=1" }],
    ["a negative id", { kind: "team", league: "wnba", id: "-1" }],
    ["a huge id", { kind: "team", league: "wnba", id: "1".repeat(30) }],
    ["a malformed date", { kind: "scoreboard", league: "wnba", dates: "2026-09-21" }],
    ["a date range", { kind: "scoreboard", league: "wnba", dates: "20260901-20260930" }],
    ["an impossible date", { kind: "scoreboard", league: "wnba", dates: "20261340" }],
    ["a date far in the past", { kind: "scoreboard", league: "wnba", dates: "19990101" }],
    ["an extra field", { kind: "standings", league: "wnba", foo: "1" }],
    ["a field that belongs to another kind", { kind: "standings", league: "wnba", dates: "20260921" }],
    ["a repeated field (array)", { kind: "standings", league: ["wnba", "wnba"] }],
    ["an object value", { kind: "standings", league: { a: 1 } }],
    ["a level out of range", { kind: "standings", league: "wnba", level: "9" }],
    ["a search with one letter", { kind: "search", query: "a" }],
    ["a search that is too long", { kind: "search", query: "a".repeat(61) }],
    ["a search with control characters", { kind: "search", query: "ab\u0000c" }],
    ["a search limit above 50", { kind: "search", query: "clark", limit: 51 }],
  ])("%s", (_label, input) => {
    expect(resolve(input)).toBeNull();
  });
});
