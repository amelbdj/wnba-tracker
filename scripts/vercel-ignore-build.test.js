import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = new URL("./vercel-ignore-build.sh", import.meta.url).pathname;

let repo;

function git(...args) {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

// Commits `files` ({ path: contents }) and returns the new commit's id.
function commit(files) {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), contents);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "change");
  return git("rev-parse", "HEAD");
}

// Runs the script as Vercel would, and returns its exit code.
function run(previousSha) {
  const env = { ...process.env };
  delete env.VERCEL_GIT_PREVIOUS_SHA;
  if (previousSha !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = previousSha;
  return spawnSync("sh", [SCRIPT], { cwd: repo, env, encoding: "utf8" }).status;
}

describe("vercel-ignore-build.sh", () => {
  let deployed; // the commit "currently deployed"

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "ignore-build-"));
    git("init", "-q");
    deployed = commit({ "src/app.js": "v1", "README.md": "docs" });
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("skips (exit 0) when only README, tests, CI or design files changed", () => {
    commit({
      "README.md": "new docs",
      "src/utils/search.test.js": "test",
      "api/share.test.js": "test",
      ".github/workflows/ci.yml": "ci",
      "design/og.svg": "svg",
      "vitest.config.js": "config",
    });
    expect(run(deployed)).toBe(0);
  });

  it("builds (exit 1) when a file that ships with the site changed", () => {
    for (const path of ["src/app.js", "api/share.js", "public/og.png", "vercel.json", "package.json", "index.html"]) {
      const before = git("rev-parse", "HEAD");
      commit({ [path]: `changed ${path}` });
      expect(run(before), path).toBe(1);
    }
  });

  it("looks at every commit since the last deployment, not just the newest", () => {
    commit({ "src/app.js": "v2" }); // real change...
    commit({ "README.md": "then a docs-only commit" }); // ...hidden behind a docs-only head
    expect(run(deployed)).toBe(1);
  });

  it("skips when nothing changed at all", () => {
    expect(run(deployed)).toBe(0);
  });

  it("builds when there is no previous deployment or it can't be found", () => {
    commit({ "README.md": "docs, edited" });
    expect(run(undefined)).toBe(1);
    expect(run("")).toBe(1);
    expect(run("0123456789abcdef0123456789abcdef01234567")).toBe(1);
  });
});
