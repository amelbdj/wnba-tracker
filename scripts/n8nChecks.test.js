import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DISCORD_PLACEHOLDER, WORKFLOW_FILE, buildWorkflow, workflowJson } from "./buildN8nWorkflow.js";
import { CHECKS, TYPES, evaluate, get, plan, runChecks } from "../ops/n8n/checks.js";

const res = (extra = {}) => ({ status: 200, headers: {}, body: "", json: null, ...extra });
const json = (data, extra = {}) => res({ json: data, body: JSON.stringify(data), ...extra });

describe("get", () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }] }, x: null };
  it("follows dots and indexes", () => {
    expect(get(obj, "a.b[1].c")).toBe(2);
    expect(get(obj, "a.b")).toHaveLength(2);
  });
  it("returns undefined instead of throwing on a missing branch", () => {
    expect(get(obj, "a.z.y")).toBeUndefined();
    expect(get(obj, "x.y")).toBeUndefined();
    expect(get(obj, "a.b[9].c")).toBeUndefined();
    expect(get(undefined, "a")).toBeUndefined();
  });
});

describe("TYPES", () => {
  it("tells empty from non-empty, and null from missing", () => {
    expect(TYPES.list([1])).toBe(true);
    expect(TYPES.list([])).toBe(false);
    expect(TYPES.arr([])).toBe(true);
    expect(TYPES.str("")).toBe(false);
    expect(TYPES.str("a")).toBe(true);
    expect(TYPES.num(NaN)).toBe(false);
    expect(TYPES.num(0)).toBe(true);
    expect(TYPES.any(null)).toBe(false);
    expect(TYPES.any(0)).toBe(true);
    expect(TYPES.bool(false)).toBe(true);
    expect(TYPES.obj([])).toBe(false);
  });
});

describe("evaluate", () => {
  const check = {
    rules: [
      ["events", "list"],
      ["events[0].id", "str"],
    ],
  };
  const good = json({ events: [{ id: "1" }] });

  it("accepts a response that has the key fields", () => {
    expect(evaluate(check, good)).toEqual({ ok: true, problems: [], warnings: [] });
  });

  it("reports an unreachable source", () => {
    const r = evaluate(check, { error: "ECONNREFUSED" });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/injoignable.*ECONNREFUSED/);
  });

  it.each([403, 404, 429, 500, 502])("reports HTTP %i", (status) => {
    const r = evaluate(check, json({ events: [{ id: "1" }] }, { status }));
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([`HTTP ${status}`]);
  });

  it("catches an empty answer", () => {
    const r = evaluate(check, json({ events: [] }));
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/« events »/);
  });

  it("catches a renamed or removed field, naming it", () => {
    const r = evaluate(check, json({ events: [{ identifier: "1" }] }));
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(["champ « events[0].id » absent ou de type inattendu (str)"]);
  });

  it("catches a field whose type changed", () => {
    expect(evaluate(check, json({ events: [{ id: 1 }] })).ok).toBe(false);
  });

  it("catches an HTML error page where JSON was expected", () => {
    const r = evaluate(check, res({ body: "<html>Bad gateway</html>" }));
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(["la réponse n'est pas du JSON"]);
  });

  it("checks that a page still contains its marker", () => {
    const page = { html: '<div id="root">' };
    expect(evaluate(page, res({ body: '<html><div id="root"></div>' })).ok).toBe(true);
    expect(evaluate(page, res({ body: "<html>maintenance</html>" })).ok).toBe(false);
  });

  it("runs custom checks too", () => {
    const custom = { custom: (data) => (data.n > 0 ? [] : ["vide"]) };
    expect(evaluate(custom, json({ n: 1 })).ok).toBe(true);
    expect(evaluate(custom, json({ n: 0 })).problems).toEqual(["vide"]);
  });

  describe("a header that should have a given value", () => {
    const warn = { rules: [], warnIfHeader: { name: "x-ncaa-source", expected: "private", message: "secours" } };
    it("is fine when it matches", () => {
      expect(evaluate(warn, json({}, { headers: { "x-ncaa-source": "private" } }))).toEqual({ ok: true, problems: [], warnings: [] });
    });
    it("is a warning, not a failure, when it doesn't", () => {
      expect(evaluate(warn, json({}, { headers: { "x-ncaa-source": "public" } }))).toEqual({ ok: true, problems: [], warnings: ["secours"] });
      expect(evaluate(warn, json({}, { headers: {} })).warnings).toEqual(["secours"]);
    });
    it("is not even looked at when the response already failed", () => {
      expect(evaluate(warn, json({}, { status: 500, headers: {} })).warnings).toEqual([]);
    });
  });
});

describe("the list of checks", () => {
  it("has unique ids and complete entries", () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHECKS) {
      expect(c.label, c.id).toBeTruthy();
      expect(c.group, c.id).toBeTruthy();
      expect(c.url, c.id).toMatch(/^https:\/\//);
    }
  });

  it("only uses field types that exist (a typo would silently never fail)", () => {
    for (const c of CHECKS) for (const [, type] of c.rules || []) expect(Object.keys(TYPES), c.id).toContain(type);
  });

  it("covers every sport and every source", () => {
    expect(new Set(CHECKS.map((c) => c.group))).toEqual(new Set(["Basket", "Volley", "Football", "FRONTROW"]));
    const urls = CHECKS.map((c) => c.url).join("\n");
    for (const host of ["site.api.espn.com", "site.web.api.espn.com", "ncaa-api.henrygd.me", "thefrontrow.fr/api/espn", "thefrontrow.fr/api/ncaa", "stats.thefrontrow.fr"]) {
      expect(urls, host).toContain(host);
    }
  });

  it("holds no secret: every URL is public and carries no key or token", () => {
    for (const c of CHECKS) expect(c.url, c.id).not.toMatch(/key|token|secret|password/i);
  });

  it("only looks at stable targets: past days, not 'today'", () => {
    for (const c of CHECKS.filter((x) => /scoreboard\?dates=/.test(x.url))) {
      const day = c.url.match(/dates=(\d{8})/)[1];
      expect(Number(day), c.id).toBeLessThan(20261101);
    }
  });

  it("spaces its calls to the public NCAA relay (3 requests per second at most)", () => {
    for (const c of CHECKS.filter((x) => x.url.includes("ncaa-api.henrygd.me"))) expect(c.spacingMs, c.id).toBeGreaterThanOrEqual(400);
  });
});

describe("runChecks", () => {
  const list = [
    { id: "a", group: "G", label: "A", url: "https://x/a", rules: [["ok", "any"]] },
    { id: "b", group: "G", label: "B", url: "https://x/b", rules: [["ok", "any"]] },
    { id: "c", group: "G", label: "C", url: "https://x/c", rules: [["ok", "any"]] },
  ];

  it("returns one result per check, in the list's order", async () => {
    const results = await runChecks(async () => json({ ok: 1 }), list);
    expect(results.map((r) => [r.id, r.ok])).toEqual([["a", true], ["b", true], ["c", true]]);
  });

  it("turns a thrown error into a failed check, without stopping the others", async () => {
    const results = await runChecks(async (url) => {
      if (url.endsWith("/b")) throw new Error("socket hang up");
      return json({ ok: 1 });
    }, list);
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(results[1].problems[0]).toMatch(/injoignable.*socket hang up/);
  });

  it("waits between calls to the checks that ask for spacing", async () => {
    const starts = {};
    const spaced = list.map((c) => ({ ...c, spacingMs: 40 }));
    await runChecks(async (url) => {
      starts[url] = Date.now();
      return json({ ok: 1 });
    }, spaced);
    const t = ["a", "b", "c"].map((k) => starts[`https://x/${k}`]);
    expect(t[1] - t[0]).toBeGreaterThanOrEqual(35);
    expect(t[2] - t[1]).toBeGreaterThanOrEqual(35);
  });

  it("starts the unspaced checks together", async () => {
    const starts = [];
    await runChecks(async () => {
      starts.push(Date.now());
      await new Promise((r) => setTimeout(r, 30));
      return json({ ok: 1 });
    }, list);
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(20);
  });
});

describe("plan (what to say, and what to remember)", () => {
  const ok = (id, label = id) => ({ id, label, group: "G", ok: true, problems: [], warnings: [] });
  const bad = (id, label = id, problem = "HTTP 502") => ({ id, label, group: "G", ok: false, problems: [problem], warnings: [] });
  const warn = (id, label = id, w = "secours") => ({ id, label, group: "G", ok: true, problems: [], warnings: [w] });

  const THURSDAY = new Date("2026-11-19T07:00:00Z");
  const FRIDAY = new Date("2026-11-20T07:00:00Z");
  const MONDAY = new Date("2026-11-23T07:00:00Z");

  it("says nothing when everything is fine on an ordinary day", () => {
    expect(plan([ok("a"), ok("b")], {}, THURSDAY)).toEqual({ message: null, state: { failing: {}, lastWeeklyOk: undefined } });
  });

  it("sends the weekly all-clear on Monday, once", () => {
    const first = plan([ok("a"), ok("b")], {}, MONDAY);
    expect(first.message).toMatch(/✅.*tout va bien.*2 contrôles réussis/);
    expect(first.state.lastWeeklyOk).toBe("2026-11-23");
    const again = plan([ok("a"), ok("b")], first.state, new Date("2026-11-23T15:00:00Z"));
    expect(again.message).toBeNull();
  });

  it("counts Monday in Paris, not in UTC", () => {
    const sundayNightUtc = new Date("2026-11-22T23:30:00Z"); // lundi 00h30 à Paris
    expect(plan([ok("a")], {}, sundayNightUtc).message).toMatch(/tout va bien/);
    const mondayNightUtc = new Date("2026-11-23T23:30:00Z"); // mardi 00h30 à Paris
    expect(plan([ok("a")], {}, mondayNightUtc).message).toBeNull();
  });

  it("reports a new failure, naming the check and the reason", () => {
    const { message, state } = plan([ok("a"), bad("b", "ESPN · classement", "champ « x » absent")], {}, THURSDAY);
    expect(message).toMatch(/🔴.*1 contrôle en échec/);
    expect(message).toContain("ESPN · classement : champ « x » absent (nouveau)");
    expect(state.failing).toEqual({ b: { since: "2026-11-19", severity: "error" } });
  });

  it("keeps reminding every day, counting the days", () => {
    const day1 = plan([bad("b", "B")], {}, THURSDAY);
    const day2 = plan([bad("b", "B")], day1.state, FRIDAY);
    expect(day2.message).toContain("B : HTTP 502 (depuis 1 jour)");
    expect(day2.state.failing.b.since).toBe("2026-11-19");
    const day5 = plan([bad("b", "B")], day1.state, new Date("2026-11-24T07:00:00Z"));
    expect(day5.message).toContain("depuis 5 jours");
  });

  it("says when something is back, and then stops mentioning it", () => {
    const down = plan([bad("b", "B")], {}, THURSDAY);
    const up = plan([ok("b", "B")], down.state, FRIDAY);
    expect(up.message).toMatch(/🟢.*Rétabli.*B/);
    expect(up.state.failing).toEqual({});
    expect(plan([ok("b", "B")], up.state, new Date("2026-11-21T07:00:00Z")).message).toBeNull();
  });

  it("does not send the weekly all-clear while something is failing", () => {
    const { message } = plan([ok("a"), bad("b")], {}, MONDAY);
    expect(message).not.toMatch(/✅/);
    expect(message).toMatch(/🔴/);
  });

  it("puts a warning apart from a failure", () => {
    const { message, state } = plan([ok("a"), warn("w", "Relais", "le relais public sert")], {}, THURSDAY);
    expect(message).toContain("🟠");
    expect(message).not.toContain("🔴");
    expect(message).toContain("Relais : le relais public sert (nouveau)");
    expect(state.failing.w.severity).toBe("warn");
  });

  it("mixes failures, warnings and recoveries in one message", () => {
    const before = { failing: { r: { since: "2026-11-18", severity: "error" } }, lastWeeklyOk: undefined };
    const { message } = plan([bad("a", "A"), warn("w", "W"), ok("r", "R")], before, THURSDAY);
    expect(message).toMatch(/🔴[\s\S]*🟠[\s\S]*🟢/);
  });

  it("stays within Discord's 2000 characters", () => {
    const many = Array.from({ length: 40 }, (_, i) => bad(`id${i}`, `Contrôle numéro ${i}`, "x".repeat(200)));
    expect(plan(many, {}, THURSDAY).message.length).toBeLessThanOrEqual(2000);
  });

  it("copes with a missing or empty previous state", () => {
    expect(() => plan([ok("a")], undefined, THURSDAY)).not.toThrow();
    expect(() => plan([bad("a")], {}, THURSDAY)).not.toThrow();
  });
});

describe("the n8n workflow file", () => {
  const committed = readFileSync(WORKFLOW_FILE, "utf8");
  const workflow = JSON.parse(committed);

  it("is up to date with ops/n8n/checks.js (run: node scripts/buildN8nWorkflow.js)", () => {
    expect(committed).toBe(workflowJson());
  });

  it("holds no Discord address: only the placeholder to replace after import", () => {
    expect(committed).not.toMatch(/discord(app)?\.com\/api\/webhooks/);
    const discord = workflow.nodes.find((n) => n.name === "Envoyer sur Discord");
    expect(discord.parameters.url).toBe(DISCORD_PLACEHOLDER);
  });

  it("is wired from both triggers to the Discord message", () => {
    const names = new Set(workflow.nodes.map((n) => n.name));
    for (const [from, { main }] of Object.entries(workflow.connections)) {
      expect(names.has(from), from).toBe(true);
      for (const link of main.flat()) expect(names.has(link.node), link.node).toBe(true);
    }
    const follow = (start) => {
      const seen = [];
      let cur = start;
      while (cur) {
        seen.push(cur);
        cur = workflow.connections[cur]?.main?.[0]?.[0]?.node;
      }
      return seen;
    };
    expect(follow("Chaque jour à 8 h").at(-1)).toBe("Envoyer sur Discord");
    expect(follow("Lancer à la main").at(-1)).toBe("Envoyer sur Discord");
  });

  it("runs every day at 8, Paris time, and is delivered switched off", () => {
    expect(workflow.settings.timezone).toBe("Europe/Paris");
    const rule = workflow.nodes.find((n) => n.type === "n8n-nodes-base.scheduleTrigger").parameters.rule.interval[0];
    expect(rule).toMatchObject({ field: "days", daysInterval: 1, triggerAtHour: 8 });
    expect(workflow.active).toBe(false);
  });

  it("reads the addresses one at a time, 0.7 s apart (the public NCAA relay allows 3 per second)", () => {
    const http = workflow.nodes.find((n) => n.name === "Lire les adresses");
    expect(http.parameters.options.batching.batch).toEqual({ batchSize: 1, batchInterval: 700 });
    expect(http.onError).toBe("continueRegularOutput"); // an unreachable source must not stop the others
  });

  it("embeds the checks as plain code (no module syntax in a Code node)", () => {
    for (const node of workflow.nodes.filter((n) => n.type === "n8n-nodes-base.code")) {
      const code = node.parameters.jsCode;
      expect(code.split("\n").some((line) => /^(export|import) /.test(line)), node.name).toBe(false);
      expect(code, node.name).toContain("const CHECKS = [");
    }
  });

  it("reads every response body shape n8n 2.x produces ('data' for text, 'body' for JSON)", () => {
    const analyse = workflow.nodes.find((n) => n.name === "Analyser les réponses").parameters.jsCode;
    expect(analyse).toContain("j.body !== undefined ? j.body : j.data");
  });

  it("builds the same thing every time", () => {
    expect(JSON.stringify(buildWorkflow())).toBe(JSON.stringify(buildWorkflow()));
  });
});
