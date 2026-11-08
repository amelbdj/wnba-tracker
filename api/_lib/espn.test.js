import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImageDataUri, pickLogoUrl } from "./espn.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const image = (type, bytes = 10) => ({
  ok: true,
  headers: { get: () => type },
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});

describe("pickLogoUrl", () => {
  it("prefers the dark-background logo, then the default one", () => {
    const logos = [
      { href: "default.png", rel: ["full", "default"] },
      { href: "dark.png", rel: ["full", "dark"] },
    ];
    expect(pickLogoUrl({ logos })).toBe("dark.png");
    expect(pickLogoUrl({ logos: [logos[0]] })).toBe("default.png");
    expect(pickLogoUrl({ logos: [{ href: "only.png", rel: ["x"] }] })).toBe("only.png");
  });

  it("falls back to the plain logo field, or null", () => {
    expect(pickLogoUrl({ logo: "plain.png" })).toBe("plain.png");
    expect(pickLogoUrl(undefined)).toBeNull();
  });
});

describe("fetchImageDataUri", () => {
  it("turns an ESPN image into a data URI", async () => {
    vi.stubGlobal("fetch", async () => image("image/png"));
    const uri = await fetchImageDataUri("https://a.espncdn.com/i/teamlogos/x.png");
    expect(uri).toMatch(/^data:image\/png;base64,/);
  });

  it("only fetches from ESPN's image CDN", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await fetchImageDataUri("https://evil.example.com/x.png")).toBeNull();
    expect(await fetchImageDataUri("http://a.espncdn.com/x.png")).toBeNull();
    expect(await fetchImageDataUri(undefined)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("skips formats the renderer can't draw, empty files and huge files", async () => {
    vi.stubGlobal("fetch", async () => image("image/webp"));
    expect(await fetchImageDataUri("https://a.espncdn.com/x.webp")).toBeNull();
    vi.stubGlobal("fetch", async () => image("image/png", 0));
    expect(await fetchImageDataUri("https://a.espncdn.com/x.png")).toBeNull();
    vi.stubGlobal("fetch", async () => image("image/png", 3_000_000));
    expect(await fetchImageDataUri("https://a.espncdn.com/x.png")).toBeNull();
  });

  it("returns null on a network error", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    expect(await fetchImageDataUri("https://a.espncdn.com/x.png")).toBeNull();
  });
});
