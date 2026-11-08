import { getLeague } from "../../src/leagues.js";

// Server-side ESPN lookups for link previews (titles and images). ESPN is
// slow or down now and then, and a preview isn't worth waiting long for: every
// call has a short timeout and just returns null on any failure.
const TIMEOUT_MS = 2500;

export async function fetchWithTimeout(url, { timeoutMs = TIMEOUT_MS, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url) {
  const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
  try {
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}

// ESPN's team object for a /<league>/teams/<id> route, or null.
export async function fetchTeam(route) {
  const { sport } = getLeague(route.league);
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${route.league}/teams/${route.id}`);
  return data?.team ?? null;
}

// ESPN's athlete object for a /<league>/players/<id> route, or null.
export async function fetchAthlete(route) {
  const { sport } = getLeague(route.league);
  const data = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${sport}/${route.league}/athletes/${route.id}`);
  return data?.athlete ?? null;
}

// An image as a data: URI (what the card renderer takes), or null. Only
// PNG/JPEG/GIF/SVG — the renderer can't draw anything else.
export async function fetchImageDataUri(url) {
  if (!/^https:\/\/[a-z0-9.-]+\.espncdn\.com\//i.test(url || "")) return null;
  const res = await fetchWithTimeout(url);
  if (!res) return null;
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(png|jpeg|gif|svg\+xml)$/.test(type)) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length > 0 && bytes.length < 2_000_000 ? `data:${type};base64,${bytes.toString("base64")}` : null;
}

// The team's logo that reads well on a dark background: ESPN's "dark" variant
// when it has one, else the default.
export function pickLogoUrl(team) {
  const logos = team?.logos || [];
  const dark = logos.find((l) => l.rel?.includes("dark"));
  return (dark || logos.find((l) => l.rel?.includes("default")) || logos[0])?.href || team?.logo || null;
}
