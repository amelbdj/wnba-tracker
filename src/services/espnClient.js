import { resolveEspnRequest } from "./espnRoutes.js";

// Every ESPN read in the app goes through here.
//
// A request is named by its kind and fields (see espnRoutes.js). It is sent
// to our own /api/espn, which caches ESPN's answers and keeps serving the last
// good one when ESPN fails. If that endpoint itself can't answer (a network
// problem, an error, or something that isn't JSON), the request goes straight
// to ESPN, as the app always did — so adding the cache can't make anything
// worse than it was. The one exception is `team`: ESPN sends no CORS headers
// for it, so the direct call can't succeed from a browser and the callers keep
// their own fallback for it.

// Leagues served through /api/espn. Rolled out in stages; "*" = all of them.
const PROXIED_LEAGUES = new Set(["wnba"]);
const PROXY_ALL = false;

// How long to wait for our endpoint before trying ESPN directly.
const PROXY_TIMEOUT_MS = 12_000;

function usesProxy(request) {
  if (PROXY_ALL) return true;
  return request.params.league !== undefined && PROXIED_LEAGUES.has(request.params.league);
}

const isJson = (res) => (res.headers.get("content-type") || "").includes("json");

// Same contract as fetch(): resolves to a Response (check `.ok`, then
// `.json()`), and rejects only when even the direct call fails.
export async function espnFetch(kind, fields = {}) {
  const request = resolveEspnRequest({ kind, ...fields });
  // Not something the app is allowed to ask: don't send it anywhere.
  if (!request) return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });

  if (usesProxy(request)) {
    try {
      const res = await fetch(`/api/espn?${request.query}`, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
      // A JSON answer is final, a 404 included (ESPN really has no such page).
      if ((res.ok || res.status === 404) && isJson(res)) return res;
    } catch {
      // fall through to ESPN
    }
  }

  return fetch(request.url);
}
