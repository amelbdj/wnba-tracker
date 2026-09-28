import { getEnv } from "../_lib/env.js";
import { withErrorHandling } from "../_lib/http.js";
import { getRedis, STATE_KEY, STATE_TTL_SECONDS } from "../_lib/redis.js";
import { getOrCreateSession, setSessionCookie } from "../_lib/session.js";
import { randomToken } from "../_lib/crypto.js";

// Direct Post only needs `video.publish` — creator_info/query and
// video/init both work with it, so we don't request `user.info.basic` too
// (least-privilege scope request, per TikTok's own review guidance).
const SCOPE = "video.publish";

export default withErrorHandling(async function handler(req, res) {
  const { tiktokClientKey, tiktokRedirectUri } = getEnv();
  const { sessionId, isNew } = getOrCreateSession(req);
  if (isNew) setSessionCookie(res, sessionId);

  const returnTo = typeof req.query.return_to === "string" ? req.query.return_to : "/post-to-tiktok";
  // Only ever redirect back into our own app after auth.
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/post-to-tiktok";

  const state = randomToken(24);
  await getRedis().set(STATE_KEY(state), { sessionId, returnTo: safeReturnTo }, { ex: STATE_TTL_SECONDS });

  const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorizeUrl.searchParams.set("client_key", tiktokClientKey);
  authorizeUrl.searchParams.set("scope", SCOPE);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", tiktokRedirectUri);
  authorizeUrl.searchParams.set("state", state);

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
});
