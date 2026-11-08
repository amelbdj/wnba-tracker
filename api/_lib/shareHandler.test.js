import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../share.js";

function call(query, { method = "GET", headers = {} } = {}) {
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
  return handler({ method, query, headers }, res).then(() => res);
}

const json = (data, ok = true) => ({ ok, json: async () => data });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api/share", () => {
  it("names a team using ESPN's data", async () => {
    const urls = [];
    vi.stubGlobal("fetch", async (url) => {
      urls.push(url);
      return json({ team: { displayName: "Nebraska Cornhuskers" } });
    });

    const res = await call({ path: "/womens-college-volleyball/teams/158" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/html");
    expect(res.headers["Cache-Control"]).toContain("s-maxage=3600");
    expect(res.body).toContain("<title>Nebraska Cornhuskers — NCAA Volley Femmes | FRONTROW</title>");
    expect(res.body).toContain("Nebraska Cornhuskers (NCAA Volley Femmes) : calendrier");
    expect(urls[0]).toBe("https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/teams/158");
  });

  it("names a basketball player using ESPN's athlete data", async () => {
    vi.stubGlobal("fetch", async () => json({ athlete: { displayName: "Alysha Clark", team: { displayName: "Las Vegas Aces" } } }));
    const res = await call({ path: "/wnba/players/924", lang: "en" });
    expect(res.body).toContain("<title>Alysha Clark — Las Vegas Aces | FRONTROW</title>");
    expect(res.body).toContain('og:locale" content="en_US"');
  });

  it("still answers when ESPN is down", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const res = await call({ path: "/wnba/teams/20" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<title>Équipe — WNBA | FRONTROW</title>");
  });

  it("doesn't call ESPN for pages that need no lookup", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call({ path: "/wnba/standings" });
    expect(res.body).toContain("<title>Classement WNBA | FRONTROW</title>");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers an unknown path with the site's own preview", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await call({ path: "/$1" });
    expect(res.body).toContain("<title>FRONTROW — The home of women&#39;s sports.</title>"); // HTML-escaped apostrophe
  });

  it("uses the host the crawler asked for, and only answers GET/HEAD", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await call({ path: "/" }, { headers: { "x-forwarded-host": "wnba-tracker-abc.vercel.app" } });
    expect(res.body).toContain("https://wnba-tracker-abc.vercel.app/og-default.png");
    expect((await call({ path: "/" }, { method: "POST" })).statusCode).toBe(405);
  });
});
