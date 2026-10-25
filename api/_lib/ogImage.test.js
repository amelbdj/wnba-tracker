import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OG_IMAGE_PATH } from "./share.js";

// The preview image must exist where the previews say it does, and be the
// 1200x630 PNG that the og:image:width/height tags promise.
describe("default preview image", () => {
  const png = readFileSync(new URL(`../../public${OG_IMAGE_PATH}`, import.meta.url));

  it("is a PNG", () => {
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("is 1200 x 630", () => {
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it("is small enough for every app (WhatsApp wants under ~300 KB)", () => {
    expect(png.length).toBeLessThan(300 * 1024);
  });
});
