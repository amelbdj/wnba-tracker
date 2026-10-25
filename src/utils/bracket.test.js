import { describe, expect, it } from "vitest";
import {
  buildLiveRounds,
  buildMatchup,
  isBracketEvent,
  isChampionshipDecided,
  labelEvents,
  localizeRoundLabel,
  normalizeRoundLabel,
  trailingWindow,
} from "./bracket";

const t = (key) => key;

describe("normalizeRoundLabel", () => {
  it("drops the game number and 'if necessary'", () => {
    expect(normalizeRoundLabel("First Round - Game 1")).toBe("First Round");
    expect(normalizeRoundLabel("WNBA Semifinals - Game 4 If Necessary")).toBe("Semifinals");
  });

  it("puts 'Semifinals' and 'WNBA Semifinals' in the same round", () => {
    expect(normalizeRoundLabel("Semifinals - Game 1")).toBe(normalizeRoundLabel("WNBA Semifinals - Game 2"));
  });

  it("keeps only the last segment of a long NCAA headline", () => {
    expect(normalizeRoundLabel("NCAA Women's Basketball Championship - Regional 2 in Sacramento - First Four")).toBe("First Four");
  });

  it("falls back to 'Playoffs' without a headline", () => {
    expect(normalizeRoundLabel(undefined)).toBe("Playoffs");
  });
});

describe("localizeRoundLabel", () => {
  it("maps the common rounds to translation keys", () => {
    expect(localizeRoundLabel("First Round", t)).toBe("playoffs.round1");
    expect(localizeRoundLabel("Quarterfinals", t)).toBe("playoffs.round1");
    expect(localizeRoundLabel("Second Round", t)).toBe("playoffs.round2");
    expect(localizeRoundLabel("Semifinals", t)).toBe("playoffs.semis");
    expect(localizeRoundLabel("Finals", t)).toBe("playoffs.final");
    expect(localizeRoundLabel("National Championship", t)).toBe("playoffs.final");
  });

  it("handles volleyball regionals and leaves the Final Four alone", () => {
    expect(localizeRoundLabel("Regional Semifinals", t)).toBe("playoffs.regionalSemis");
    expect(localizeRoundLabel("Lincoln Regional", t)).toBe("playoffs.regionalFinal");
    expect(localizeRoundLabel("Final Four", t)).toBe("Final Four");
  });
});

let counter = 0;
function event({ headline, ids, completed = false, state = "pre", series, winnerId, date, scores = [0, 0] }) {
  counter += 1;
  return {
    id: String(counter),
    date: date || `2026-10-${String(10 + counter).padStart(2, "0")}T20:00Z`,
    competitions: [
      {
        notes: headline ? [{ headline }] : [],
        status: { type: { completed, state: completed ? "post" : state } },
        series,
        competitors: ids.map((id, i) => ({
          team: { id: String(id), displayName: `Team ${id}`, shortDisplayName: `T${id}` },
          score: String(scores[i]),
          winner: winnerId != null && String(winnerId) === String(id),
        })),
      },
    ],
  };
}
describe("isBracketEvent", () => {
  it("needs a round headline, and ignores group stages", () => {
    expect(isBracketEvent(event({ ids: [1, 2] }), undefined)).toBe(false);
    expect(isBracketEvent(event({ headline: "Group A - Game 1", ids: [1, 2] }), undefined)).toBe(false);
    expect(isBracketEvent(event({ headline: "Semifinals - Game 1", ids: [1, 2] }), undefined)).toBe(true);
  });

  it("applies a league's headline prefix (NCAA volleyball)", () => {
    const config = { headlinePrefix: /^NCAA Women's Volleyball Championship/i };
    expect(isBracketEvent(event({ headline: "NCAA Women's Volleyball Championship - First Round", ids: [1, 2] }), config)).toBe(true);
    expect(isBracketEvent(event({ headline: "Big Ten Tournament - Semifinals", ids: [1, 2] }), config)).toBe(false);
  });
});

describe("labelEvents", () => {
  it("labels most games straight from their headline", () => {
    const e = event({ headline: "WNBA Finals - Game 2", ids: [1, 2] });
    expect(labelEvents([e]).get(e.id)).toBe("Finals");
  });

  it("splits a regional into semifinals and final by who already played", () => {
    const h = "NCAA Women's Volleyball Championship - Lincoln Regional";
    const s1 = event({ headline: h, ids: [1, 2], date: "2026-12-04T20:00Z" });
    const s2 = event({ headline: h, ids: [3, 4], date: "2026-12-04T22:00Z" });
    const final = event({ headline: h, ids: [1, 3], date: "2026-12-05T20:00Z" });
    const labels = labelEvents([final, s2, s1]);
    expect(labels.get(s1.id)).toBe("Regional Semifinals");
    expect(labels.get(s2.id)).toBe("Regional Semifinals");
    expect(labels.get(final.id)).toBe("Regional Final");
  });
});

describe("buildMatchup", () => {
  it("collapses a best-of series into one matchup with the series score", () => {
    const series = { completed: false, summary: "A leads 2-1", competitors: [{ id: "1", wins: 2 }, { id: "2", wins: 1 }] };
    const g1 = event({ headline: "Finals - Game 1", ids: [1, 2], completed: true, winnerId: 1, series, scores: [80, 70] });
    const g2 = event({ headline: "Finals - Game 2", ids: [2, 1], completed: true, winnerId: 2, series, scores: [75, 72] });
    const m = buildMatchup("1-2", [g2, g1]);
    expect(m.hasSeries).toBe(true);
    expect(m.started).toBe(true);
    expect(m.teams.map((x) => [x.id, x.wins])).toEqual([["1", 2], ["2", 1]]);
    expect(m.winnerId).toBeNull(); // 2-1 isn't a won series
  });

  it("names the series winner once it is decided", () => {
    const series = { completed: true, summary: "Team 1 wins series 3-1", competitors: [{ id: "1", wins: 3 }, { id: "2", wins: 1 }] };
    const g = event({ headline: "Finals - Game 4", ids: [1, 2], completed: true, winnerId: 1, series });
    expect(buildMatchup("1-2", [g]).winnerId).toBe("1");
  });

  it("takes the winner of a single-elimination game directly", () => {
    const g = event({ headline: "Round of 64", ids: [1, 2], completed: true, winnerId: 2 });
    const m = buildMatchup("1-2", [g]);
    expect(m.hasSeries).toBe(false);
    expect(m.winnerId).toBe("2");
  });

  it("marks TBD placeholders so they get no lineage", () => {
    const g = event({ headline: "Round of 32", ids: [1, -1] });
    const m = buildMatchup("1--1", [g]);
    expect(m.teams[1].isTbd).toBe(true);
    expect(m.teamIds).toEqual(["1"]);
  });
});

describe("buildLiveRounds", () => {
  it("orders rounds by date and places feeder matchups next to the game they feed", () => {
    // Games arrive out of bracket order; the lineage of winners puts them right.
    const q1 = event({ headline: "Quarterfinals", ids: [1, 8], completed: true, winnerId: 1, date: "2026-10-01T20:00Z" });
    const q2 = event({ headline: "Quarterfinals", ids: [4, 5], completed: true, winnerId: 4, date: "2026-10-01T22:00Z" });
    const q3 = event({ headline: "Quarterfinals", ids: [2, 7], completed: true, winnerId: 2, date: "2026-10-02T20:00Z" });
    const q4 = event({ headline: "Quarterfinals", ids: [3, 6], completed: true, winnerId: 3, date: "2026-10-02T22:00Z" });
    const s1 = event({ headline: "Semifinals", ids: [1, 3], date: "2026-10-05T20:00Z" });
    const s2 = event({ headline: "Semifinals", ids: [4, 2], date: "2026-10-05T22:00Z" });
    const final = event({ headline: "Finals", ids: [1, 4], date: "2026-10-09T20:00Z" });

    const rounds = buildLiveRounds([q2, q4, q1, q3, final, s2, s1]);
    expect(rounds.map((r) => r.label)).toEqual(["Quarterfinals", "Semifinals", "Finals"]);

    // Walking back from the final (1 v 4): its feeders are the semifinals
    // (1, 3) then (4, 2), and each semifinal's feeders sit right before it.
    expect(rounds[2].matchups.map((m) => m.teamIds)).toEqual([["1", "4"]]);
    expect(rounds[1].matchups.map((m) => m.teamIds)).toEqual([["1", "3"], ["4", "2"]]);
    expect(rounds[0].matchups.map((m) => m.teamIds)).toEqual([["1", "8"], ["3", "6"], ["4", "5"], ["2", "7"]]);
  });
});

describe("isChampionshipDecided", () => {
  const semi = (a, b, winner) => event({ headline: "Semifinals", ids: [a, b], completed: true, winnerId: winner, date: "2026-10-05T20:00Z" });

  it("is true once the final matchup has a winner", () => {
    const final = event({ headline: "Finals", ids: [1, 2], completed: true, winnerId: 1, date: "2026-10-09T20:00Z" });
    expect(isChampionshipDecided([semi(1, 3, 1), semi(2, 4, 2), final])).toBe(true);
  });

  it("is false while the final is still to be played", () => {
    const final = event({ headline: "Finals", ids: [1, 2], date: "2026-10-09T20:00Z" });
    expect(isChampionshipDecided([semi(1, 3, 1), semi(2, 4, 2), final])).toBe(false);
  });

  it("is false with a single round", () => {
    const only = event({ headline: "Finals", ids: [1, 2], completed: true, winnerId: 1 });
    expect(isChampionshipDecided([only])).toBe(false);
  });
});

describe("trailingWindow", () => {
  const range = { startDate: "2026-08-01T00:00:00.000Z", endDate: "2027-01-10T00:00:00.000Z" };

  it("keeps only the last N days of a long window", () => {
    const w = trailingWindow(range, 35);
    expect(w.endDate).toBe(range.endDate);
    expect(new Date(w.startDate).toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });

  it("never reaches back before the window starts", () => {
    expect(trailingWindow({ startDate: "2027-01-01T00:00:00.000Z", endDate: range.endDate }, 35).startDate).toBe("2027-01-01T00:00:00.000Z");
  });

  it("returns the window untouched without a day limit", () => {
    expect(trailingWindow(range, undefined)).toBe(range);
  });
});
