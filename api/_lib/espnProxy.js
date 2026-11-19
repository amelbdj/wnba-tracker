import { gzipSync } from "node:zlib";
import { resolveEspnRequest } from "../../src/services/espnRoutes.js";
import { NOT_FOUND_CACHE, cacheControlFor } from "./espnCache.js";

// Reads an ESPN endpoint on behalf of the browser (see api/espn.js).
//
// The answer is validated before anything is cached: ESPN sometimes returns
// an error page with a 200, and caching that would hide a good answer behind a
// bad one. Anything that isn't a clean JSON answer becomes a 502, which
// Vercel's CDN replaces with the last good copy (stale-if-error) when it has one.

const TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 300;

// Vercel refuses a function response over 4.5 MB. A few ESPN answers are far
// bigger as plain text (the NCAA basketball standings are about 6 MB) but
// compress to ~200 KB, so anything large is sent gzipped.
const GZIP_ABOVE_BYTES = 3_000_000;

// No custom User-Agent on purpose: ESPN answers 403 to one that identifies
// itself with a web address ("FRONTROW (+https://…)"), while the runtime's
// default is accepted.

async function attempt(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    // ESPN answers 400 as well as 404 for a resource that doesn't exist for a
    // league (e.g. league statistics for volleyball or FIBA): a real answer,
    // not a failure, so it isn't retried or replaced by a stale copy.
    if (res.status === 404 || res.status === 400) return { ok: false, notFound: true };
    // 5xx and network failures are worth one more try; 4xx (429 included)
    // are not: asking again right away would only make it worse.
    if (res.status >= 500) return { ok: false, retry: true };
    if (!res.ok) return { ok: false };
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false }; // an HTML error page served as 200
    }
    if (data === null || typeof data !== "object") return { ok: false };
    return { ok: true, data, text };
  } catch {
    return { ok: false, retry: true }; // timeout or network error
  } finally {
    clearTimeout(timer);
  }
}

// -> { ok: true, data, text } | { ok: false, notFound? }
export async function fetchEspn(url, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS, retryDelayMs = RETRY_DELAY_MS } = {}) {
  let result = await attempt(url, fetchImpl, timeoutMs);
  if (!result.ok && result.retry) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    result = await attempt(url, fetchImpl, timeoutMs);
  }
  return result;
}

// The body to send, and the header that goes with it when it is compressed.
export function encodeBody(text) {
  if (Buffer.byteLength(text) <= GZIP_ABOVE_BYTES) return { body: text, headers: {} };
  return {
    body: gzipSync(text),
    headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
  };
}

// The Vercel function: GET /api/espn?kind=scoreboard&league=wnba&dates=20260921
export async function handleEspnRequest(req, res, options = {}) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }


  const request = resolveEspnRequest(req.query);
  // Fields must come in the canonical order too: the same request in another
  // order would be another cache entry, a free way to bypass the cache.
  const canonical = request && Object.keys(req.query).join() === [...new URLSearchParams(request.query).keys()].join();
  if (!canonical) {
    res.setHeader("Cache-Control", "public, s-maxage=3600");
    res.status(400).json({ error: "invalid_param", message: "Unknown or malformed request." });
    return;
  }

  const upstream = await fetchEspn(request.url, options);

  if (!upstream.ok) {
    if (upstream.notFound) {
      res.setHeader("Cache-Control", NOT_FOUND_CACHE);
      res.status(404).json({ error: "not_found" });
      return;
    }
    // Never cached: a 5xx is what lets the CDN fall back to its last good copy.
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "upstream_error" });
    return;
  }

  const { body, headers } = encodeBody(upstream.text);
  res.setHeader("Cache-Control", cacheControlFor(request.kind, request.params, upstream.data, options.now));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.status(200).send(body);
}
