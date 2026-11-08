import { describe, expect, it } from "vitest";
import { CARD, accentFor, drawable, leagueCard, nameSize, playerCard, renderCard, teamCard } from "./ogCard.js";

// A 1x1 PNG, standing in for a logo or headshot.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function jpegSize(bytes) {
  // Walk the JPEG markers to the start-of-frame segment: [precision, height, width].
  let i = 2;
  while (i < bytes.length) {
    const marker = bytes[i + 1];
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  return null;
}

describe("accentFor", () => {
  it("keeps a team colour that shows up on the dark background", () => {
    expect(accentFor("FE0D04")).toBe("fe0d04");
  });

  it("lifts a colour that is too dark, and falls back to the brand purple for junk", () => {
    const lifted = accentFor("002b5c");
    expect(lifted).not.toBe("002b5c");
    expect(parseInt(lifted.slice(0, 2), 16)).toBeGreaterThan(0x00);
    expect(accentFor(undefined)).toBe("7a3ae6");
    expect(accentFor("not-a-colour")).toBe("7a3ae6");
  });
});

describe("drawable", () => {
  it("keeps what the fonts can draw (Latin-1)", () => {
    expect(drawable("Ñandú Ødegård Çelik Müller Åsa")).toBe("Ñandú Ødegård Çelik Müller Åsa");
  });

  it("replaces letters the fonts lack with their base letter", () => {
    // ó and ç are Latin-1, so they stay; Š, Ł, ź, ğ, Đ and đ are replaced
    expect(drawable("Šimić Łódź Çağlar Đorđević")).toBe("Simic Lódz Çaglar Dordevic");
    expect(drawable("Žarko Čomić Ğ")).toBe("Zarko Comic G");
  });

  it("copes with empty input", () => {
    expect(drawable(undefined)).toBe("");
    expect(drawable("")).toBe("");
  });
});

describe("nameSize", () => {
  it("shrinks long names so they still fit", () => {
    expect(nameSize("Utah")).toBeGreaterThan(nameSize("Nebraska Cornhuskers"));
    expect(nameSize("Nebraska Cornhuskers")).toBeGreaterThan(nameSize("Texas A&M-Corpus Christi Islanders"));
    expect(nameSize("x".repeat(60))).toBe(66);
  });
});

describe("renderCard", () => {
  const cases = {
    team: () => teamCard("fr", { name: "Nebraska Cornhuskers", leagueName: "NCAA Volley Femmes", color: "fe0d04", logo: PIXEL }),
    "team without a logo": () => teamCard("en", { name: "Utah", leagueName: "WNBA", color: undefined }),
    "very long team name": () => teamCard("es", { name: "Texas A&M-Corpus Christi Islanders of the Gulf Coast Conference", leagueName: "Baloncesto femenino NCAA", logo: PIXEL }),
    "player with stats": () =>
      playerCard("fr", {
        name: "Caitlin Clark", leagueName: "WNBA", color: "002d62", logo: PIXEL, headshot: PIXEL,
        subtitle: "Indiana Fever · Guard · #22",
        stats: [{ label: "PPG", value: "22.3" }, { label: "RPG", value: "4.0" }, { label: "APG", value: "8.3" }],
        season: "2026",
      }),
    "player without stats": () => playerCard("fr", { name: "Alysha Clark", leagueName: "WNBA", subtitle: "Dallas Wings" }),
    "volleyball player": () => playerCard("fr", { name: "Gabby Divita", leagueName: "NCAA Volley Femmes", initials: "GD", subtitle: "Nebraska", tagline: "Stats de la saison" }),
    "league (volleyball)": () => leagueCard("fr", { leagueName: "NCAA Volley Femmes", sport: "volleyball", section: "standings" }),
    "league (basketball)": () => leagueCard("en", { leagueName: "WNBA", sport: "basketball", section: "" }),
    "league (football)": () => leagueCard("fr", { leagueName: "Première Ligue", sport: "soccer", section: "standings" }),
  };

  for (const [name, build] of Object.entries(cases)) {
    it(`draws a 1200x630 JPEG under 300 KB: ${name}`, async () => {
      const jpg = await renderCard(build());
      expect(jpg.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(jpegSize(jpg)).toEqual({ width: CARD.width, height: CARD.height });
      expect(jpg.length).toBeLessThan(300 * 1024);
    });
  }
});
