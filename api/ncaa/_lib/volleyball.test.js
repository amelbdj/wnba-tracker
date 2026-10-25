import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUpstream, resolveVolleyballRequest } from "./volleyball.js";

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
    await expect(fetchUpstream("/scoreboard/x")).resolves.toEqual({ status: 200, ok: true, data: { games: [] } });
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
