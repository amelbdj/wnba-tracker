import { afterEach, describe, expect, it, vi } from "vitest";
import { espnFetch } from "./espnClient";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function stubFetch(...answers) {
  const calls = [];
  vi.stubGlobal("fetch", async (url) => {
    calls.push(String(url));
    const next = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const PROXY = "/api/espn?dates=20260921&kind=scoreboard&league=wnba";
const DIRECT = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=20260921";

describe("espnFetch", () => {
  it("asks our own endpoint first, with the canonical query", async () => {
    const calls = stubFetch(json({ events: [] }));
    const res = await espnFetch("scoreboard", { league: "wnba", dates: "20260921" });
    expect(await res.json()).toEqual({ events: [] });
    expect(calls).toEqual([PROXY]);
  });

  it("falls back to ESPN when our endpoint answers with an error", async () => {
    const calls = stubFetch(json({ error: "upstream_error" }, 502), json({ events: ["direct"] }));
    const res = await espnFetch("scoreboard", { league: "wnba", dates: "20260921" });
    expect(await res.json()).toEqual({ events: ["direct"] });
    expect(calls).toEqual([PROXY, DIRECT]);
  });

  it("falls back to ESPN when our endpoint can't be reached", async () => {
    const calls = stubFetch(new TypeError("Failed to fetch"), json({ events: ["direct"] }));
    const res = await espnFetch("scoreboard", { league: "wnba", dates: "20260921" });
    expect(await res.json()).toEqual({ events: ["direct"] });
    expect(calls).toEqual([PROXY, DIRECT]);
  });

  it("falls back to ESPN when the answer isn't JSON (e.g. the site's own page)", async () => {
    const html = new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
    const calls = stubFetch(html, json({ events: ["direct"] }));
    const res = await espnFetch("scoreboard", { league: "wnba", dates: "20260921" });
    expect(await res.json()).toEqual({ events: ["direct"] });
    expect(calls).toHaveLength(2);
  });

  it("treats a 404 from our endpoint as final (ESPN really has no such page)", async () => {
    const calls = stubFetch(json({ error: "not_found" }, 404));
    const res = await espnFetch("scoreboard", { league: "wnba", dates: "20260921" });
    expect(res.status).toBe(404);
    expect(calls).toEqual([PROXY]);
  });

  it("serves every league through our endpoint, not just one", async () => {
    for (const league of ["womens-college-basketball", "womens-college-volleyball", "fra.w.1"]) {
      const calls = stubFetch(json({ events: [] }));
      await espnFetch("scoreboard", { league, dates: "20260921" });
      expect(calls, league).toEqual([`/api/espn?dates=20260921&kind=scoreboard&league=${league}`]);
    }
  });

  it("serves the league-less player search through it too", async () => {
    const calls = stubFetch(json({ results: [] }));
    await espnFetch("search", { query: "clark", limit: 20 });
    expect(calls).toEqual(["/api/espn?kind=search&limit=20&query=clark"]);
  });

  it("falls back to ESPN for the search too", async () => {
    const calls = stubFetch(json({}, 502), json({ results: [] }));
    await espnFetch("search", { query: "clark", limit: 20 });
    expect(calls[1]).toBe("https://site.api.espn.com/apis/search/v2?query=clark&type=player&limit=20");
  });

  it("sends nothing anywhere for a request the app isn't allowed to make", async () => {
    const calls = stubFetch(json({}));
    const res = await espnFetch("team", { league: "wnba", id: "14/../../x" });
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("rejects when even the direct call fails (callers decide what to do)", async () => {
    stubFetch(json({}, 502), new TypeError("Failed to fetch"));
    await expect(espnFetch("scoreboard", { league: "wnba", dates: "20260921" })).rejects.toThrow();
  });
});
