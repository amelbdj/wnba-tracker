import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUpstream, resolveVolleyballRequest, privateRelay } from "./volleyball.js";

describe("resolveVolleyballRequest", () => {
  it("builds the upstream path for the three supported requests", () => {
    expect(resolveVolleyballRequest({ stat: "42", page: "2" })).toEqual({
      kind: "stats",
      path: "/stats/volleyball-women/d1/current/individual/42/p2",
    });
    expect(resolveVolleyballRequest({ stat: "553" })).toEqual({
      kind: "stats",
      path: "/stats/volleyball-women/d1/current/individual/553",
    });
    expect(resolveVolleyballRequest({ scoreboard: "20261017" })).toEqual({
      kind: "scoreboard",
      path: "/scoreboard/volleyball-women/d1/2026/10/17",
    });
    expect(resolveVolleyballRequest({ boxscore: "6624613" })).toEqual({
      kind: "boxscore",
      path: "/game/6624613/boxscore",
    });
  });

  it("rejects anything that isn't one of those, so the proxy can't be aimed elsewhere", () => {
    for (const query of [
      {},
      { stat: "999" }, // not an allowed stat id
      { stat: "42", page: "0" },
      { stat: "42", page: "21" },
      { stat: "42/../../admin" },
      { scoreboard: "2026-10-17" },
      { scoreboard: "20261317" }, // month 13
      { scoreboard: "../../etc/passwd" },
      { boxscore: "12" }, // too short
      { boxscore: "123456/../../x" },
      { boxscore: "abc123" },
      { other: "1" },
    ]) {
      expect(resolveVolleyballRequest(query), JSON.stringify(query)).toBeNull();
    }
  });
});

describe("fetchUpstream", () => {
  const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => body });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the data of a good response", async () => {
    vi.stubGlobal("fetch", async () => reply(200, '{"games":[]}'));
    await expect(fetchUpstream("/scoreboard/x")).resolves.toEqual({ status: 200, ok: true, data: { games: [] }, source: "public" });
  });

  it("retries when the upstream answers with its HTML rate-limit page", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => (++calls <= 2 ? reply(428, "<html>428 Precondition Required</html>") : reply(200, '{"a":1}')));

    const result = fetchUpstream("/x");
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toMatchObject({ ok: true, data: { a: 1 } });
    expect(calls).toBe(3);
  });

  it("retries 5xx errors and 429s too", async () => {
    const statuses = [503, 429];
    let calls = 0;
    vi.stubGlobal("fetch", async () => (calls < statuses.length ? reply(statuses[calls++], "{}") : (calls++, reply(200, '{"ok":true}'))));

    const result = fetchUpstream("/x");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toMatchObject({ ok: true });
    expect(calls).toBe(3);
  });

  it("retries a 428 even when its body happens to be JSON", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => (++calls === 1 ? reply(428, '{"message":"slow down"}') : reply(200, '{"ok":true}')));

    const result = fetchUpstream("/x");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toMatchObject({ ok: true });
    expect(calls).toBe(2);
  });

  it("treats a 404 as final, without retrying", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => (++calls, reply(404, '{"message":"not found"}')));
    const result = await fetchUpstream("/x");
    expect(result).toMatchObject({ status: 404, ok: false });
    expect(calls).toBe(1);
  });

  it("gives up after four attempts and reports failure", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => (++calls, reply(428, "<html/>")));

    const result = fetchUpstream("/x");
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toMatchObject({ ok: false, status: 428 });
    expect(calls).toBe(4);
  });

  it("recovers from a network error", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      if (++calls === 1) throw new Error("socket hang up");
      return reply(200, '{"ok":1}');
    });

    const result = fetchUpstream("/x");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toMatchObject({ ok: true });
  });

  it("never has more than four requests in flight", async () => {
    let current = 0;
    let max = 0;
    vi.stubGlobal("fetch", async () => {
      current += 1;
      max = Math.max(max, current);
      await new Promise((resolve) => setTimeout(resolve, 20));
      current -= 1;
      return reply(200, "{}");
    });

    const all = Promise.all(Array.from({ length: 20 }, () => fetchUpstream("/x")));
    await vi.advanceTimersByTimeAsync(1000);
    await all;
    expect(max).toBeLessThanOrEqual(4);
    expect(max).toBeGreaterThan(1);
  });
});

describe("privateRelay", () => {
  const ok = { NCAA_API_URL: "https://ncaa.example.fr", NCAA_API_KEY: "secret" };

  it("is off unless both the URL and the key are set", () => {
    expect(privateRelay({})).toBeNull();
    expect(privateRelay({ NCAA_API_URL: ok.NCAA_API_URL })).toBeNull();
    expect(privateRelay({ NCAA_API_KEY: "secret" })).toBeNull();
    expect(privateRelay({ NCAA_API_URL: "  ", NCAA_API_KEY: "secret" })).toBeNull();
  });

  it("uses the origin of the URL, trimming spaces and any path", () => {
    expect(privateRelay({ NCAA_API_URL: " https://ncaa.example.fr/ ", NCAA_API_KEY: " secret " })).toEqual({
      base: "https://ncaa.example.fr",
      key: "secret",
    });
    expect(privateRelay({ NCAA_API_URL: "https://ncaa.example.fr/some/path", NCAA_API_KEY: "k" }).base).toBe(
      "https://ncaa.example.fr",
    );
  });

  it("refuses to send the key over plain http, except to localhost", () => {
    expect(privateRelay({ NCAA_API_URL: "http://ncaa.example.fr", NCAA_API_KEY: "k" })).toBeNull();
    expect(privateRelay({ NCAA_API_URL: "http://127.0.0.1:3011", NCAA_API_KEY: "k" })).toMatchObject({
      base: "http://127.0.0.1:3011",
    });
    expect(privateRelay({ NCAA_API_URL: "http://localhost:3011", NCAA_API_KEY: "k" })).not.toBeNull();
  });

  it("turns itself off on a URL that isn't one", () => {
    expect(privateRelay({ NCAA_API_URL: "not a url", NCAA_API_KEY: "k" })).toBeNull();
    expect(privateRelay({ NCAA_API_URL: "ftp://ncaa.example.fr", NCAA_API_KEY: "k" })).toBeNull();
  });
});

describe("fetchUpstream with our own relay configured", () => {
  const env = { NCAA_API_URL: "https://ncaa.example.fr", NCAA_API_KEY: "secret-key" };
  const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => body });

  // Records every call as { url, headers } and answers from a function of the URL.
  function stub(answer) {
    const calls = [];
    vi.stubGlobal("fetch", async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers ?? {} });
      return answer(String(url), calls.length);
    });
    return calls;
  }
  const isPrivate = (url) => url.startsWith("https://ncaa.example.fr");

  let errors;
  beforeEach(() => {
    vi.useFakeTimers();
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const run = async (path = "/stats/x") => {
    const result = fetchUpstream(path, { env });
    await vi.advanceTimersByTimeAsync(20_000);
    return result;
  };

  it("asks our own relay first, with the key, and never touches the public one", async () => {
    const calls = stub(() => reply(200, '{"a":1}'));
    expect(await run()).toEqual({ status: 200, ok: true, data: { a: 1 }, source: "private" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://ncaa.example.fr/stats/x");
    expect(calls[0].headers["x-ncaa-key"]).toBe("secret-key");
  });

  it("retries once on its own relay before giving up on it", async () => {
    const calls = stub((url, n) => (n === 1 ? reply(503, "") : reply(200, '{"a":1}')));
    expect(await run()).toMatchObject({ ok: true, source: "private" });
    expect(calls.map((c) => isPrivate(c.url))).toEqual([true, true]);
  });

  it.each([
    ["is down for good (5xx)", () => reply(500, "boom")],
    ["answers with an HTML page", () => reply(200, "<html>oops</html>")],
    ["refuses the key (401)", () => reply(401, "")],
    ["rate-limits us (429)", () => reply(429, "{}")],
  ])("falls back to the public relay when our own %s", async (_label, privateAnswer) => {
    const calls = stub((url) => (isPrivate(url) ? privateAnswer() : reply(200, '{"from":"public"}')));
    expect(await run()).toEqual({ status: 200, ok: true, data: { from: "public" }, source: "public" });
    expect(calls.some((c) => !isPrivate(c.url))).toBe(true);
  });

  it("falls back when our own relay can't be reached", async () => {
    stub((url) => {
      if (isPrivate(url)) throw new Error("ECONNREFUSED");
      return reply(200, '{"from":"public"}');
    });
    expect(await run()).toMatchObject({ ok: true, source: "public" });
  });

  it("falls back when our own relay hangs", async () => {
    vi.stubGlobal("fetch", (url, init) =>
      isPrivate(String(url))
        ? new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))
        : Promise.resolve(reply(200, '{"from":"public"}')),
    );
    expect(await run()).toMatchObject({ ok: true, source: "public" });
  });

  it("never sends the key to the public relay", async () => {
    const calls = stub((url) => (isPrivate(url) ? reply(500, "") : reply(200, "{}")));
    await run();
    const publicCalls = calls.filter((c) => !isPrivate(c.url));
    expect(publicCalls.length).toBeGreaterThan(0);
    for (const call of publicCalls) expect(JSON.stringify(call.headers)).not.toContain("secret-key");
  });

  it("never writes the key in the logs when it falls back", async () => {
    stub((url) => (isPrivate(url) ? reply(401, "") : reply(200, "{}")));
    await run();
    expect(errors).toHaveBeenCalled();
    expect(JSON.stringify(errors.mock.calls)).not.toContain("secret-key");
  });

  it("treats a 404 from our own relay as final, even with a plain-text body", async () => {
    const calls = stub(() => reply(404, "NOT_FOUND"));
    expect(await run()).toMatchObject({ status: 404, ok: false, source: "private" });
    expect(calls).toHaveLength(1);
  });

  it("goes straight to the public relay when the URL isn't safe for the key", async () => {
    const calls = stub(() => reply(200, "{}"));
    const result = fetchUpstream("/x", { env: { NCAA_API_URL: "http://ncaa.example.fr", NCAA_API_KEY: "k" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toMatchObject({ source: "public" });
    expect(calls.every((c) => !isPrivate(c.url))).toBe(true);
  });

  it("gives up with the public relay's failure when both are down", async () => {
    stub((url) => (isPrivate(url) ? reply(500, "") : reply(428, "<html/>")));
    expect(await run()).toMatchObject({ ok: false, status: 428, source: "public" });
  });
});
