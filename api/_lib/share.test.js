import { describe, expect, it } from "vitest";
import {
  buildMeta,
  escapeHtml,
  nameFromSlug,
  parseSharePath,
  renderShareHtml,
  resolveLang,
  resolveOrigin,
} from "./share.js";

describe("parseSharePath", () => {
  it("recognises every kind of page of the app", () => {
    expect(parseSharePath("/")).toEqual({ kind: "site" });
    expect(parseSharePath("/wnba")).toMatchObject({ kind: "league", league: "wnba", section: "", canonical: "/wnba" });
    expect(parseSharePath("/wnba/standings")).toMatchObject({ kind: "league", section: "standings", canonical: "/wnba/standings" });
    expect(parseSharePath("/womens-college-volleyball/teams/158")).toMatchObject({ kind: "team", id: "158", canonical: "/womens-college-volleyball/teams/158" });
    expect(parseSharePath("/wnba/players/924")).toMatchObject({ kind: "player", id: "924" });
    expect(parseSharePath("/womens-college-volleyball/teams/158/players/gabby-divita")).toMatchObject({
      kind: "volleyballPlayer",
      id: "158",
      slug: "gabby-divita",
    });
    expect(parseSharePath("/privacy")).toMatchObject({ kind: "page", page: "privacy" });
    expect(parseSharePath("/terms")).toMatchObject({ kind: "page", page: "terms" });
  });

  it("ignores query strings, fragments and trailing slashes", () => {
    expect(parseSharePath("/wnba/teams/20/?x=1#top")).toMatchObject({ kind: "team", id: "20", canonical: "/wnba/teams/20" });
  });

  it("falls back to something safe for paths that aren't pages", () => {
    expect(parseSharePath("/not-a-league")).toEqual({ kind: "site" });
    expect(parseSharePath("/$1")).toEqual({ kind: "site" }); // an unresolved rewrite placeholder
    expect(parseSharePath(undefined)).toEqual({ kind: "site" });
    expect(parseSharePath("/wnba/unknown")).toMatchObject({ kind: "league", section: "", canonical: "/wnba" });
    expect(parseSharePath("/wnba/teams/abc")).toMatchObject({ kind: "league", canonical: "/wnba" });
  });

  it("only accepts well-formed ids and slugs, so nothing odd reaches a preview", () => {
    expect(parseSharePath("/wnba/teams/20/players/<script>").kind).not.toBe("volleyballPlayer");
    expect(parseSharePath("/wnba/teams/20/players/Bad_Slug").kind).not.toBe("volleyballPlayer");
    expect(parseSharePath("/wnba/players/12345678901234").kind).not.toBe("player");
  });
});

describe("buildMeta", () => {
  it("describes the site", () => {
    const meta = buildMeta({ kind: "site" }, "fr");
    expect(meta.title).toBe("FRONTROW — The home of women's sports.");
    expect(meta.description).toContain("WNBA");
    expect(meta.path).toBe("/");
  });

  it("titles a league page and its sections in the right language", () => {
    expect(buildMeta(parseSharePath("/womens-college-volleyball"), "fr").title).toBe(
      "NCAA Volley Femmes — Scores et résultats | FRONTROW",
    );
    expect(buildMeta(parseSharePath("/wnba/standings"), "en").title).toBe("WNBA standings | FRONTROW");
    expect(buildMeta(parseSharePath("/wnba/players"), "es").title).toBe("Jugadoras WNBA | FRONTROW");
  });

  it("names a team", () => {
    const route = parseSharePath("/womens-college-volleyball/teams/158");
    const meta = buildMeta(route, "fr", { name: "Nebraska Cornhuskers" });
    expect(meta.title).toBe("Nebraska Cornhuskers — NCAA Volley Femmes | FRONTROW");
    expect(meta.description).toBe("Nebraska Cornhuskers (NCAA Volley Femmes) : calendrier, résultats, effectif et stats.");
  });

  it("degrades to a generic team preview when ESPN couldn't be reached", () => {
    const meta = buildMeta(parseSharePath("/wnba/teams/20"), "fr", {});
    expect(meta.title).toBe("Équipe — WNBA | FRONTROW");
    expect(meta.path).toBe("/wnba/teams/20");
  });

  it("names a basketball player and her team", () => {
    const meta = buildMeta(parseSharePath("/wnba/players/924"), "en", { name: "Alysha Clark", team: "Las Vegas Aces" });
    expect(meta.title).toBe("Alysha Clark — Las Vegas Aces | FRONTROW");
    expect(meta.description).toContain("Alysha Clark");
  });

  it("builds a volleyball player's name from the URL when nothing else is known", () => {
    const route = parseSharePath("/womens-college-volleyball/teams/158/players/gabby-divita");
    expect(buildMeta(route, "fr", {}).title).toBe("Gabby Divita — NCAA Volley Femmes | FRONTROW");
    const withTeam = buildMeta(route, "fr", { team: "Nebraska" });
    expect(withTeam.title).toBe("Gabby Divita — Nebraska | FRONTROW");
    expect(withTeam.description).toContain("moyennes par set");
    expect(withTeam.description.startsWith("Gabby Divita (Nebraska)")).toBe(true);
  });
});

describe("preview image", () => {
  it("points pages that have a card at /api/og, with their canonical path and language", () => {
    const meta = buildMeta(parseSharePath("/womens-college-volleyball/teams/158"), "es", { name: "Nebraska" });
    expect(meta.image).toBe("/api/og?path=%2Fwomens-college-volleyball%2Fteams%2F158&lang=es");
    expect(buildMeta(parseSharePath("/wnba/standings"), "fr").image).toBe("/api/og?path=%2Fwnba%2Fstandings&lang=fr");
    expect(buildMeta(parseSharePath("/wnba/players/924"), "fr", {}).image).toContain("/api/og?path=%2Fwnba%2Fplayers%2F924");
  });

  it("keeps the brand image for the site and the legal pages", () => {
    expect(buildMeta({ kind: "site" }, "fr").image).toBeUndefined();
    expect(buildMeta(parseSharePath("/privacy"), "fr").image).toBeUndefined();
  });

  it("renders the card URL, absolute and escaped, into og:image", () => {
    const meta = buildMeta(parseSharePath("/wnba/teams/20"), "fr", { name: "Atlanta Dream" });
    const html = renderShareHtml(meta, { origin: "https://thefrontrow.fr", lang: "fr" });
    expect(html).toContain('<meta property="og:image" content="https://thefrontrow.fr/api/og?path=%2Fwnba%2Fteams%2F20&amp;lang=fr">');
    expect(html).toContain('<meta name="twitter:image" content="https://thefrontrow.fr/api/og?path=%2Fwnba%2Fteams%2F20&amp;lang=fr">');
  });
});

describe("football leagues", () => {
  it("are known pages, with names in every language", () => {
    for (const slug of ["fra.w.1", "uefa.wchampions", "usa.nwsl", "eng.w.1", "esp.w.1", "fifa.wwc"]) {
      expect(parseSharePath(`/${slug}/teams/21637`), slug).toMatchObject({ kind: "team", league: slug, id: "21637" });
      for (const lang of ["fr", "en", "es"]) {
        const meta = buildMeta(parseSharePath(`/${slug}/standings`), lang);
        expect(meta.title, `${slug} ${lang}`).not.toMatch(/undefined|\{league\}/);
        expect(meta.title.length).toBeGreaterThan(" | FRONTROW".length + 4);
      }
    }
  });

  it("title a team with the league's real name", () => {
    const route = parseSharePath("/fra.w.1/teams/21637");
    expect(buildMeta(route, "fr", { name: "FC Fleury 91" }).title).toBe("FC Fleury 91 — Première Ligue | FRONTROW");
    expect(buildMeta(route, "en", { name: "FC Fleury 91" }).title).toBe("FC Fleury 91 — French Première Ligue | FRONTROW");
  });
});

describe("nameFromSlug", () => {
  it("capitalises each word", () => {
    expect(nameFromSlug("gabby-divita")).toBe("Gabby Divita");
    expect(nameFromSlug("a-b-c")).toBe("A B C");
  });
});

describe("resolveLang / resolveOrigin", () => {
  it("defaults to French and accepts the three supported languages", () => {
    expect(resolveLang(undefined)).toBe("fr");
    expect(resolveLang("de")).toBe("fr");
    expect(resolveLang("en")).toBe("en");
    expect(resolveLang("es")).toBe("es");
  });

  it("echoes a plausible host (so previews can be tested) and falls back to the site", () => {
    expect(resolveOrigin("wnba-tracker-git-x.vercel.app")).toBe("https://wnba-tracker-git-x.vercel.app");
    expect(resolveOrigin("thefrontrow.fr")).toBe("https://thefrontrow.fr");
    expect(resolveOrigin("localhost:5173")).toBe("https://thefrontrow.fr");
    expect(resolveOrigin("evil.com/<script>")).toBe("https://thefrontrow.fr");
    expect(resolveOrigin(undefined)).toBe("https://thefrontrow.fr");
  });
});

describe("renderShareHtml", () => {
  const meta = { title: "Nebraska — NCAA | FRONTROW", description: "Résultats de Nebraska.", path: "/womens-college-volleyball/teams/158" };

  it("carries the Open Graph and Twitter tags crawlers read", () => {
    const html = renderShareHtml(meta, { lang: "fr" });
    expect(html).toContain("<title>Nebraska — NCAA | FRONTROW</title>");
    expect(html).toContain('<meta property="og:title" content="Nebraska — NCAA | FRONTROW">');
    expect(html).toContain('<meta property="og:url" content="https://thefrontrow.fr/womens-college-volleyball/teams/158">');
    expect(html).toContain('<meta property="og:image" content="https://thefrontrow.fr/og-default.png">');
    expect(html).toContain('<meta property="og:locale" content="fr_FR">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<link rel="canonical" href="https://thefrontrow.fr/womens-college-volleyball/teams/158">');
  });

  it("uses the requested origin for URLs and the image", () => {
    const html = renderShareHtml(meta, { origin: "https://preview.vercel.app" });
    expect(html).toContain('content="https://preview.vercel.app/og-default.png"');
  });

  it("escapes anything that came from outside", () => {
    const html = renderShareHtml({ title: '"><script>alert(1)</script>', description: "a & b <i>", path: "/" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &lt;i&gt;");
    expect(escapeHtml(`'"&<>`)).toBe("&#39;&quot;&amp;&lt;&gt;");
  });

  it("keeps descriptions short enough for previews", () => {
    const html = renderShareHtml({ ...meta, description: "x".repeat(500) });
    const content = /name="description" content="([^"]*)"/.exec(html)[1];
    expect(content.length).toBeLessThanOrEqual(200);
    expect(content.endsWith("…")).toBe(true);
  });
});
