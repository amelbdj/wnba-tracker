// Central place to read and validate the environment variables the TikTok
// integration needs. Throwing a clear, specific error here means a missing
// variable shows up as an obvious message in the Vercel function logs
// instead of a confusing downstream failure (e.g. "fetch failed" from a
// Redis client that got `undefined` as its URL).
const REQUIRED_VARS = [
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "TIKTOK_REDIRECT_URI",
  "SESSION_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

export function getEnv() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "See .env.example for what each one is and how to generate it.",
    );
  }

  return {
    tiktokClientKey: process.env.TIKTOK_CLIENT_KEY,
    tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET,
    tiktokRedirectUri: process.env.TIKTOK_REDIRECT_URI,
    sessionSecret: process.env.SESSION_SECRET,
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}
