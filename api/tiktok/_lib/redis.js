import { Redis } from "@upstash/redis";
import { getEnv } from "./env.js";

let client = null;

// Upstash's REST client is stateless HTTP under the hood, so a single
// instance is safe to reuse across invocations of the same serverless
// function (and cheap to recreate on a cold start).
export function getRedis() {
  if (!client) {
    const { upstashUrl, upstashToken } = getEnv();
    client = new Redis({ url: upstashUrl, token: upstashToken });
  }
  return client;
}

export const TOKENS_KEY = (sessionId) => `tiktok:tokens:${sessionId}`;
export const STATE_KEY = (state) => `tiktok:state:${state}`;
export const PUBLISH_OWNER_KEY = (publishId) => `tiktok:publish:${publishId}`;

export const STATE_TTL_SECONDS = 10 * 60; // OAuth `state` is single-use, short-lived
export const PUBLISH_OWNER_TTL_SECONDS = 24 * 60 * 60; // matches TikTok's own status-polling window
