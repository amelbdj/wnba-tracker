import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./og.js";

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function call(query, method = "GET") {
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
  return handler({ method, query, headers: {} }, res).then(() => res);
}

const logos = [{ href: "https://a.espncdn.com/i/teamlogos/x/500-dark/1.png", rel: ["full", "dark"] }];

// Answers ESPN's JSON endpoints and its image CDN.
function stubEspn({ team, athlete, imagesFail = false } = {}) {
  const urls = [];
  vi.stubGlobal("fetch", async (url) => {
    urls.push(String(url));
    if (/espncdn\.com/.test(url)) {
      if (imagesFail) return { ok: false };
      return { ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => PIXEL };
    }
    if (/\/teams\//.test(url)) return team ? { ok: true, json: async () => ({ team }) } : { ok: false };
    if (/\/athletes\//.test(url)) return athlete ? { ok: true, json: async () => ({ athlete }) } : { ok: false };
    return { ok: false };
  });
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const isJpeg = (body) => Buffer.isBuffer(body) && body[0] === 0xff && body[1] === 0xd8;

describe("api/og", () => {
  it("draws a team's card from ESPN's data", async () => {
    const urls = stubEspn({ team: { displayName: "Nebraska Cornhuskers", color: "fe0d04", logos } });
    const res = await call({ path: "/womens-college-volleyball/teams/158" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/jpeg");
    expect(res.headers["Cache-Control"]).toContain("s-maxage=86400");
    expect(isJpeg(res.body)).toBe(true);
    expect(urls.some((u) => u.endsWith("/500-dark/1.png"))).toBe(true); // the dark-background logo
  });

  it("draws a basketball player's card with her headshot and stats", async () => {
    stubEspn({
      athlete: {
        displayName: "Caitlin Clark",
        headshot: { href: "https://a.espncdn.com/i/headshots/wnba/players/full/4433403.png" },
        team: { displayName: "Indiana Fever", color: "002d62", logos },
        position: { displayName: "Guard" },
        displayJersey: "#22",
        statsSummary: { displayName: "2026 regular season stats", statistics: [{ shortDisplayName: "PPG", displayValue: "22.3" }] },
      },
    });
    const res = await call({ path: "/wnba/players/4433403", lang: "en" });
    expect(isJpeg(res.body)).toBe(true);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=21600"); // stats move after each game
  });

  it("still draws a card when the logo can't be fetched", async () => {
    stubEspn({ team: { displayName: "Atlanta Dream", color: "e31837", logos }, imagesFail: true });
    expect(isJpeg((await call({ path: "/wnba/teams/20" })).body)).toBe(true);
  });

  it("draws a volleyball player's card from the URL and her team", async () => {
    stubEspn({ team: { displayName: "Nebraska Cornhuskers", shortDisplayName: "Nebraska", color: "fe0d04", logos } });
    const res = await call({ path: "/womens-college-volleyball/teams/158/players/gabby-divita" });
    expect(isJpeg(res.body)).toBe(true);
  });

  it("draws a league card without calling ESPN", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call({ path: "/womens-college-volleyball/standings", lang: "fr" });
    expect(isJpeg(res.body)).toBe(true);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=604800");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends visitors to the brand image when ESPN doesn't know the page", async () => {
    stubEspn({}); // nothing found
    const res = await call({ path: "/wnba/teams/99999999" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe("/og-default.png");
  });

  it("falls back for pages without a card of their own, and for junk paths", async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const path of ["/", "/privacy", "/<script>", undefined]) {
      const res = await call({ path });
      expect(res.statusCode, String(path)).toBe(302);
    }
  });

  it("only answers GET and HEAD", async () => {
    expect((await call({ path: "/wnba" }, "POST")).statusCode).toBe(405);
  });
});
