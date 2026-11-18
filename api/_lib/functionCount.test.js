import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Vercel turns every .js file under api/ into a serverless function — except
// those inside a folder whose name starts with "_" — and the Hobby plan allows
// 12 per deployment. A test file left outside an _underscore folder counts as
// one (that is how a deployment once failed with 13), so this guards both.
const API_DIR = new URL("..", import.meta.url).pathname;
const HOBBY_LIMIT = 12;

// The functions that are supposed to exist (3 of the 12 allowed). Adding or
// removing one is a deliberate change: update this list with it, so a function
// appearing by accident (a stray file in api/) fails here instead of in a
// deployment.
const EXPECTED_FUNCTIONS = ["ncaa/volleyball.js", "og.js", "share.js"];

function functionFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith("_")) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return functionFiles(path);
    return /\.(js|mjs|cjs|ts)$/.test(entry.name) ? [relative(API_DIR, path)] : [];
  });
}

describe("api/ serverless functions", () => {
  const files = functionFiles(API_DIR);

  it("stay within the Hobby plan's limit of 12 per deployment", () => {
    expect(files.length, files.join(", ")).toBeLessThanOrEqual(HOBBY_LIMIT);
  });

  it("are exactly the expected ones", () => {
    expect([...files].sort(), `${files.length} of ${HOBBY_LIMIT} functions`).toEqual([...EXPECTED_FUNCTIONS].sort());
  });

  it("never include a test file (put tests in an _underscore folder such as _lib)", () => {
    expect(files.filter((f) => /\.test\./.test(f))).toEqual([]);
  });
});
