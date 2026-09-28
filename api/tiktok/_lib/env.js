// Central place to read and validate the environment variables the TikTok
// integration needs. Throwing a clear, specific error here means a missing
// variable shows up as an obvious message in the Vercel function logs
// instead of a confusing downstream failure (e.g. "fetch failed" from a
// Redis client that got `undefined` as its URL).

// Vercel's Upstash Marketplace integration names variables after the store
// (e.g. "wnba_KV_REST_API_URL", "wnba_KV_REST_API_TOKEN") rather than the
// plain UPSTASH_REDIS_REST_* names — this falls back to whatever store name
// was used, so it keeps working even if the store gets renamed or
// recreated. `_KV_REST_API_TOKEN` deliberately doesn't match
// "..._KV_REST_API_READ_ONLY_TOKEN": we need the read-write token to store
// connections, not the read-only one.
function findBySuffix(suffix) {
  const key = Object.keys(process.env).find((k) => k.endsWith(suffix));
  return key ? process.env[key] : undefined;
}

function resolveUpstashUrl() {
  return process.env.UPSTASH_REDIS_REST_URL || findBySuffix("_KV_REST_API_URL");
}

function resolveUpstashToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || findBySuffix("_KV_REST_API_TOKEN");
}

export function getEnv() {
  const resolved = {
    tiktokClientKey: process.env.TIKTOK_CLIENT_KEY,
    tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET,
    tiktokRedirectUri: process.env.TIKTOK_REDIRECT_URI,
    sessionSecret: process.env.SESSION_SECRET,
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    upstashUrl: resolveUpstashUrl(),
    upstashToken: resolveUpstashToken(),
  };

  const missing = Object.entries(resolved)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "See .env.example for what each one is and how to generate it.",
    );
  }

  return resolved;
}
