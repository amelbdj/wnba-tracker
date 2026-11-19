import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { NOT_FOUND_CACHE, cacheControlFor } from "./espnCache.js";
import { encodeBody, fetchEspn, handleEspnRequest } from "./espnProxy.js";

const NOW = Date.UTC(2026, 8, 21, 15, 0, 0); // 21 Sep 2026

// A stand-in for fetch: answers from a list, one per call, and records the URLs.
function fakeFetch(...answers) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const next = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  };
  impl.calls = calls;
  return impl;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

// A stand-in for the response object a Vercel function receives.
function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  return res;
}

const request = (query, method = "GET") => ({ method, query });
const options = (fetchImpl) => ({ fetchImpl, now: NOW, retryDelayMs: 0, timeoutMs: 50 });

describe("fetchEspn", () => {
  it("returns the parsed answer and its text", async () => {
    const result = await fetchEspn("https://x/y", options(fakeFetch(json({ events: [] }))));
    expect(result).toMatchObject({ ok: true, data: { events: [] }, text: '{"events":[]}' });
  });

  it("reports a 404 as not found, without retrying", async () => {
    const f = fakeFetch(new Response("nope", { status: 404 }));
    expect(await fetchEspn("https://x/y", options(f))).toMatchObject({ ok: false, notFound: true });
    expect(f.calls).toHaveLength(1);
  });

  it("retries once after a 5xx", async () => {
    const f = fakeFetch(new Response("", { status: 503 }), json({ ok: 1 }));
    expect(await fetchEspn("https://x/y", options(f))).toMatchObject({ ok: true });
    expect(f.calls).toHaveLength(2);
  });

  it("gives up after two failures", async () => {
    const f = fakeFetch(new Response("", { status: 500 }));
    expect(await fetchEspn("https://x/y", options(f))).toMatchObject({ ok: false });
    expect(f.calls).toHaveLength(2);
  });

  it("retries once after a network error", async () => {
    const f = fakeFetch(new Error("ECONNRESET"), json({ ok: 1 }));
    expect(await fetchEspn("https://x/y", options(f))).toMatchObject({ ok: true });
  });

  it("does not retry a 429: asking again straight away would only make it worse", async () => {
    const f = fakeFetch(new Response("", { status: 429 }));
    expect(await fetchEspn("https://x/y", options(f))).toMatchObject({ ok: false });
    expect(f.calls).toHaveLength(1);
  });

  it("refuses an HTML error page served with a 200", async () => {
    const f = fakeFetch(new Response("<html>Service unavailable</html>", { status: 200 }));
    expect(await fetchEspn("https://x/y", options(f))).toMatchObject({ ok: false });
  });

  it("refuses JSON that isn't an object (null, a number)", async () => {
    expect(await fetchEspn("https://x/y", options(fakeFetch(new Response("null"))))).toMatchObject({ ok: false });
    expect(await fetchEspn("https://x/y", options(fakeFetch(new Response("42"))))).toMatchObject({ ok: false });
  });

  it("gives up on a request that never answers", async () => {
    const hanging = (url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    expect(await fetchEspn("https://x/y", { fetchImpl: hanging, timeoutMs: 10, retryDelayMs: 0 })).toMatchObject({
      ok: false,
    });
  });

  it("sends no custom User-Agent (ESPN answers 403 to one that carries a web address)", async () => {
    let headers;
    await fetchEspn("https://x/y", {
      fetchImpl: async (url, init) => {
        headers = init.headers;
        return json({});
      },
    });
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("user-agent");
  });
});

describe("encodeBody", () => {
  it("sends small answers as they are", () => {
    expect(encodeBody('{"a":1}')).toEqual({ body: '{"a":1}', headers: {} });
  });

  it("gzips an answer too big for a function response (4.5 MB limit)", () => {
    const text = JSON.stringify({ rows: Array.from({ length: 80_000 }, (_, i) => ({ id: i, name: `Team number ${i}` })) });
    expect(text.length).toBeGreaterThan(3_000_000);
    const { body, headers } = encodeBody(text);
    expect(headers["Content-Encoding"]).toBe("gzip");
    expect(headers.Vary).toBe("Accept-Encoding");
    expect(body.length).toBeLessThan(1_000_000);
    expect(gunzipSync(body).toString()).toBe(text);
  });
});

describe("cacheControlFor", () => {
  const cc = (kind, params, data) => cacheControlFor(kind, params, data, NOW);

  it("keeps today's, yesterday's and tomorrow's scoreboards fresh for 20 s", () => {
    for (const dates of ["20260921", "20260920", "20260919", "20260922"]) {
      expect(cc("scoreboard", { dates }), dates).toMatch(/^public, s-maxage=20, stale-while-revalidate=60, stale-if-error=86400$/);
    }
  });

  it("keeps a scoreboard from well in the past for a day", () => {
    expect(cc("scoreboard", { dates: "20260918" })).toMatch(/s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800/);
    expect(cc("scoreboard", { dates: "20250101" })).toMatch(/s-maxage=86400/);
  });

  it("keeps a future scoreboard for 10 minutes", () => {
    expect(cc("scoreboard", { dates: "20260925" })).toMatch(/s-maxage=600/);
  });

  it("keeps a live match 20 s and a finished one a day", () => {
    const live = { header: { competitions: [{ status: { type: { completed: false } } }] } };
    const done = { header: { competitions: [{ status: { type: { completed: true } } }] } };
    expect(cc("summary", {}, live)).toMatch(/s-maxage=20,/);
    expect(cc("summary", {}, done)).toMatch(/s-maxage=86400,/);
    expect(cc("summary", {}, {})).toMatch(/s-maxage=20,/); // can't tell: stay fresh
  });

  it("gives slower data longer lives", () => {
    expect(cc("standings", {})).toMatch(/s-maxage=600,/);
    expect(cc("team", {})).toMatch(/s-maxage=1800,/);
    expect(cc("roster", {})).toMatch(/s-maxage=21600,/);
    expect(cc("athlete", {})).toMatch(/s-maxage=21600,/);
    expect(cc("athleteOverview", {})).toMatch(/s-maxage=3600,/);
    expect(cc("search", {})).toMatch(/s-maxage=3600,/);
  });

  it("every cacheable answer can be served stale when ESPN is failing", () => {
    for (const kind of ["scoreboard", "summary", "standings", "team", "roster", "schedule", "statistics", "athlete", "athleteOverview", "athleteGameLog", "search"]) {
      expect(cc(kind, { dates: "20260921" }, {}), kind).toMatch(/stale-if-error=\d+/);
    }
  });
});

describe("the function", () => {
  const good = { league: "wnba", dates: "20260921", kind: "scoreboard" };
  const query = { dates: "20260921", kind: "scoreboard", league: "wnba" };

  it("answers a valid request with ESPN's JSON and a cache header", async () => {
    const f = fakeFetch(json({ events: [{ id: "1" }] }));
    const res = fakeRes();
    await handleEspnRequest(request(query), res, options(f));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ events: [{ id: "1" }] });
    expect(res.headers["cache-control"]).toMatch(/s-maxage=20/);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(f.calls).toEqual(["https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=20260921"]);
  });

  it("answers a HEAD request too", async () => {
    const res = fakeRes();
    await handleEspnRequest(request(query, "HEAD"), res, options(fakeFetch(json({}))));
    expect(res.statusCode).toBe(200);
  });

  it("refuses other methods", async () => {
    const f = fakeFetch(json({}));
    const res = fakeRes();
    await handleEspnRequest(request(query, "POST"), res, options(f));
    expect(res.statusCode).toBe(405);
    expect(f.calls).toHaveLength(0);
  });

  it.each([
    ["an unknown kind", { kind: "teams", league: "wnba" }],
    ["an unknown league", { kind: "standings", league: "nba" }],
    ["an extra field", { ...good, foo: "bar" }],
    ["a path smuggled in", { kind: "team", league: "wnba", id: "../../../etc/passwd" }],
    ["fields out of the canonical order", good], // league, dates, kind  ≠  dates, kind, league
  ])("rejects %s without calling ESPN", async (_label, bad) => {
    const f = fakeFetch(json({}));
    const res = fakeRes();
    await handleEspnRequest(request(bad), res, options(f));
    expect(res.statusCode).toBe(400);
    expect(f.calls).toHaveLength(0);
  });

  it("passes ESPN's 404 on, cached briefly", async () => {
    const res = fakeRes();
    await handleEspnRequest(request(query), res, options(fakeFetch(new Response("", { status: 404 }))));
    expect(res.statusCode).toBe(404);
    expect(res.headers["cache-control"]).toBe(NOT_FOUND_CACHE);
  });

  it("turns any other failure into an uncached 502, so the CDN can serve its last good copy", async () => {
    for (const failing of [new Response("", { status: 500 }), new Response("<html>", { status: 200 }), new Error("down")]) {
      const res = fakeRes();
      await handleEspnRequest(request(query), res, options(fakeFetch(failing)));
      expect(res.statusCode).toBe(502);
      expect(res.headers["cache-control"]).toBe("no-store");
    }
  });
});
