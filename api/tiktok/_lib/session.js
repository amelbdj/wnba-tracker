import { randomToken, sign, verifySignature } from "./crypto.js";
import { getEnv } from "./env.js";

// FrontRow has no user accounts, so "who is this" for the TikTok
// integration is an anonymous, per-browser session: a random id in a
// signed, httpOnly cookie. The signature stops a client from forging or
// guessing another visitor's session id; nothing personally identifying is
// ever stored against it.
const COOKIE_NAME = "fr_sess";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function buildCookie(value) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ].join("; ");
}

// Reads the session id from the request, creating (and asking the browser
// to store) a new one if it's missing or its signature doesn't check out.
// Returns { sessionId, isNew } — callers that respond with JSON must set
// the returned Set-Cookie header themselves when `isNew` is true.
export function getOrCreateSession(req) {
  const { sessionSecret } = getEnv();
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];

  if (raw) {
    const dot = raw.lastIndexOf(".");
    if (dot !== -1) {
      const sessionId = raw.slice(0, dot);
      const signature = raw.slice(dot + 1);
      if (verifySignature(sessionId, signature, sessionSecret)) {
        return { sessionId, isNew: false };
      }
    }
  }

  const sessionId = randomToken(18);
  return { sessionId, isNew: true };
}

export function setSessionCookie(res, sessionId) {
  const { sessionSecret } = getEnv();
  const signature = sign(sessionId, sessionSecret);
  res.setHeader("Set-Cookie", buildCookie(`${sessionId}.${signature}`));
}
