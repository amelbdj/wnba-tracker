import { withErrorHandling } from "../_lib/http.js";
import { getRedis, STATE_KEY } from "../_lib/redis.js";
import { getOrCreateSession, setSessionCookie } from "../_lib/session.js";
import { exchangeCodeForTokens, storeTokens } from "../_lib/tiktokClient.js";

function redirectWithStatus(res, returnTo, status) {
  const url = new URL(returnTo, "https://placeholder.local"); // base is discarded, path+query kept
  url.searchParams.set("tiktok", status);
  res.writeHead(302, { Location: url.pathname + url.search });
  res.end();
}

export default withErrorHandling(async function handler(req, res) {
  const { code, state, error } = req.query;
  const { sessionId, isNew } = getOrCreateSession(req);
  if (isNew) setSessionCookie(res, sessionId);

  if (error) {
    // User declined the TikTok consent screen — not an app error.
    redirectWithStatus(res, "/post-to-tiktok", "denied");
    return;
  }

  if (!code || !state) {
    redirectWithStatus(res, "/post-to-tiktok", "error");
    return;
  }

  const redis = getRedis();
  const stateRecord = await redis.get(STATE_KEY(state));
  await redis.del(STATE_KEY(state)); // one-time use regardless of outcome

  if (!stateRecord || stateRecord.sessionId !== sessionId) {
    // Expired, already used, or doesn't belong to this browser session.
    redirectWithStatus(res, "/post-to-tiktok", "error");
    return;
  }

  const { ok, data } = await exchangeCodeForTokens(code);
  if (!ok) {
    console.error("[tiktok] token exchange failed", data);
    redirectWithStatus(res, stateRecord.returnTo, "error");
    return;
  }

  await storeTokens(sessionId, data);
  redirectWithStatus(res, stateRecord.returnTo, "connected");
});
