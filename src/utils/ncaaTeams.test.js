import { describe, expect, it } from "vitest";
import { buildTeamIndex, findNcaaGame, findTeam, normalizeTeamName } from "./ncaaTeams";

describe("normalizeTeamName", () => {
  it("expands NCAA.com's abbreviations", () => {
    expect(normalizeTeamName("Eastern Wash.")).toBe("eastern washington");
    expect(normalizeTeamName("Ala.-Birmingham")).toBe("alabama birmingham");
  });

  it("drops state tags unless asked to keep them", () => {
    expect(normalizeTeamName("St. John's (NY)")).toBe("st johns");
    expect(normalizeTeamName("Miami (OH)")).toBe("miami");
    expect(normalizeTeamName("Miami (OH)", { keepTag: true })).toBe("miami oh");
  });

  it("reads a trailing St. as State but not a leading one", () => {
    expect(normalizeTeamName("Ohio St.")).toBe("ohio state");
    expect(normalizeTeamName("St. Thomas")).toBe("st thomas");
  });

  it("ignores every kind of apostrophe, so Hawai'i matches Hawaii", () => {
    expect(normalizeTeamName("Hawai‘i")).toBe(normalizeTeamName("Hawaii"));
    expect(normalizeTeamName("Hawai'i")).toBe("hawaii");
  });
});

const espn = (id, location, displayName, abbreviation, shortDisplayName = location) => ({
  id,
  location,
  displayName,
  abbreviation,
  shortDisplayName,
});

describe("findTeam", () => {
  const southern = espn("2582", "Southern", "Southern Jaguars", "SOU");
  const hawaii = espn("62", "Hawai'i", "Hawai'i Rainbow Warriors", "HAW");
  const miamiOh = espn("193", "Miami (OH)", "Miami (OH) RedHawks", "M-OH", "Miami (OH)");
  const miamiFl = espn("2390", "Miami", "Miami Hurricanes", "MIA");
  const index = buildTeamIndex([southern, hawaii, miamiOh, miamiFl]);

  it("finds a team by its plain name", () => {
    expect(findTeam(index, "Hawaii")).toBe(hawaii);
  });

  it("uses the alias table for names no normalising connects", () => {
    expect(findTeam(index, "Southern U.")).toBe(southern);
  });

  it("tells two schools sharing a name apart by their state tag", () => {
    expect(findTeam(index, "Miami (OH)")).toBe(miamiOh);
    expect(findTeam(index, "Miami (FL)")).toBe(miamiFl);
  });

  it("returns null for an unknown team", () => {
    expect(findTeam(index, "Atlantis Tech")).toBeNull();
  });
});

describe("findNcaaGame", () => {
  const side = (short, seo) => ({ names: { short, seo, full: "", char6: "" } });
  const game = (id, home, away) => ({ gameID: id, home, away });

  const nebraska = espn("158", "Nebraska", "Nebraska Cornhuskers", "NEB");
  const ucla = espn("26", "UCLA", "UCLA Bruins", "UCLA");

  it("finds the game with both teams and says which side the first one is on", () => {
    const games = [
      game("1", side("Nebraska", "nebraska"), side("UCLA", "ucla")),
      game("2", side("Texas", "texas"), side("Baylor", "baylor")),
    ];
    expect(findNcaaGame(games, nebraska, ucla)).toMatchObject({ game: { gameID: "1" }, aIsHome: true });
    expect(findNcaaGame(games, ucla, nebraska)).toMatchObject({ game: { gameID: "1" }, aIsHome: false });
  });

  it("returns null when the game isn't listed", () => {
    const games = [game("2", side("Texas", "texas"), side("Baylor", "baylor"))];
    expect(findNcaaGame(games, nebraska, ucla)).toBeNull();
  });

  it("returns null rather than guess when several games would fit", () => {
    const games = [
      game("1", side("Nebraska", "nebraska"), side("UCLA", "ucla")),
      game("2", side("Nebraska", "nebraska"), side("UCLA", "ucla")),
    ];
    expect(findNcaaGame(games, nebraska, ucla)).toBeNull();
  });

  it("separates Columbia from Columbia (SC) using the tagged spelling", () => {
    const princeton = espn("163", "Princeton", "Princeton Tigers", "PRIN");
    const columbia = espn("171", "Columbia", "Columbia Lions", "CLMB");
    const games = [
      game("10", side("Princeton", "princeton"), side("Columbia (SC)", "columbia-college")),
      game("11", side("Princeton", "princeton"), side("Columbia", "columbia")),
    ];
    expect(findNcaaGame(games, princeton, columbia)).toMatchObject({ game: { gameID: "11" } });
  });

  it("matches Southern U. and Hawaii despite their different spellings", () => {
    const southern = espn("2582", "Southern", "Southern Jaguars", "SOU");
    const hawaii = espn("62", "Hawai'i", "Hawai'i Rainbow Warriors", "HAW");
    const games = [
      game("20", side("Southern U.", "southern-u"), side("Dillard", "dillard")),
      game("21", side("Hawaii", "hawaii"), side("UNLV", "unlv")),
    ];
    const dillard = espn("9", "Dillard", "Dillard Bleu Devils", "DIL");
    const unlv = espn("2439", "UNLV", "UNLV Rebels", "UNLV");
    expect(findNcaaGame(games, southern, dillard)).toMatchObject({ game: { gameID: "20" } });
    expect(findNcaaGame(games, unlv, hawaii)).toMatchObject({ game: { gameID: "21" }, aIsHome: false });
  });
});
