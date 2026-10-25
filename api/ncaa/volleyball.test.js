import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./volleyball.js";

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
    json(body) {
      this.body = body;
      return this;
    },
  };
  return handler({ method, query }, res).then(() => res);
}

const upstream = (status, data) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
});

describe("api/ncaa/volleyball", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("only answers GET", async () => {
    expect((await call({ stat: "42" }, "POST")).statusCode).toBe(405);
  });

  it("refuses requests it doesn't recognise", async () => {
    const res = await call({ boxscore: "nope" });
    expect(res.statusCode).toBe(400);
  });

  it("caches a final box score for a day", async () => {
    vi.stubGlobal("fetch", async () => upstream(200, { status: "F" }));
    const res = await call({ boxscore: "6624613" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=86400");
  });

  it("keeps a live box score fresh for seconds only", async () => {
    vi.stubGlobal("fetch", async () => upstream(200, { status: "I" }));
    const res = await call({ boxscore: "6624613" });
    expect(res.headers["Cache-Control"]).toContain("s-maxage=20");
  });

  it("caches an old scoreboard long and a recent one briefly", async () => {
    vi.stubGlobal("fetch", async () => upstream(200, { games: [] }));
    expect((await call({ scoreboard: "20261010" })).headers["Cache-Control"]).toContain("s-maxage=86400");
    expect((await call({ scoreboard: "20261025" })).headers["Cache-Control"]).toContain("s-maxage=300");
    expect((await call({ scoreboard: "20261024" })).headers["Cache-Control"]).toContain("s-maxage=300");
  });

  it("answers 404 for an unknown game and never caches errors", async () => {
    vi.stubGlobal("fetch", async () => upstream(404, { message: "not found" }));
    const res = await call({ boxscore: "6624613" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("answers 502 when the upstream keeps turning us away", async () => {
    vi.stubGlobal("fetch", async () => upstream(428, "<html>428</html>"));
    const pending = call({ boxscore: "6624613" });
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await pending;
    expect(res.statusCode).toBe(502);
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });
});
