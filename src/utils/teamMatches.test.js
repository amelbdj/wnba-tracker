import { describe, expect, it } from "vitest";
import { toMatch } from "./teamMatches";

const t = (key) => key;

const team = (id, name) => ({ id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase(), logos: [{ href: `${id}.png` }] });
const competitor = (id, name, homeAway, score) => ({
  homeAway,
  team: team(id, name),
  score: score == null ? undefined : { displayValue: String(score) },
});
const event = (status, scores = [3, 1], extra = {}) => ({
  id: "e1",
  date: "2026-10-24T20:00Z",
  seasonType: { type: 2 },
  competitions: [
    {
      neutralSite: false,
      status,
      competitors: [competitor("10", "Home", "home", scores[0]), competitor("20", "Away", "away", scores[1])],
    },
  ],
  ...extra,
});

const final = { type: { state: "post", completed: true, name: "STATUS_FINAL", description: "Final" } };

describe("toMatch", () => {
  it("reads a finished match from the point of view of the requested team", () => {
    const home = toMatch(event(final), "10", t);
    expect(home).toMatchObject({ state: "final", home: true, score: [3, 1], won: true });
    expect(home.opponent).toMatchObject({ id: "20", displayName: "Away", logo: "20.png" });

    const away = toMatch(event(final), "20", t);
    expect(away).toMatchObject({ state: "final", home: false, score: [1, 3], won: false });
  });

  it("distinguishes live, upcoming and never-played matches", () => {
    expect(toMatch(event({ type: { state: "in", completed: false } }), "10", t).state).toBe("live");
    expect(toMatch(event({ type: { state: "pre", completed: false, name: "STATUS_SCHEDULED" } }), "10", t).state).toBe("upcoming");

    const postponed = toMatch(
      event({ type: { state: "post", completed: false, name: "STATUS_POSTPONED", description: "Postponed" } }),
      "10",
      t,
    );
    expect(postponed.state).toBe("other");
    expect(postponed.note).toContain("postponed");
  });

  it("tags preseason and postseason matches only", () => {
    expect(toMatch(event(final, [3, 1], { seasonType: { type: 1 } }), "10", t).phase).toBe("preseason");
    expect(toMatch(event(final, [3, 1], { seasonType: { type: 3 } }), "10", t).phase).toBe("postseason");
    expect(toMatch(event(final), "10", t).phase).toBeNull();
  });

  it("returns null when the team isn't in the match", () => {
    expect(toMatch(event(final), "99", t)).toBeNull();
    expect(toMatch({ id: "x", competitions: [] }, "10", t)).toBeNull();
  });
});
