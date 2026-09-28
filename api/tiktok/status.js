import { withErrorHandling, methodGuard } from "./_lib/http.js";
import { getOrCreateSession, setSessionCookie } from "./_lib/session.js";
import { getValidAccessToken } from "./_lib/tiktokClient.js";

// Cheap, no-scope-required check: is there a usable TikTok connection for
// this browser? Doesn't call TikTok at all unless a refresh is due, so the
// UI can poll/check this freely without burning rate limit.
export default withErrorHandling(async function handler(req, res) {
  if (!methodGuard(req, res, "GET")) return;

  const { sessionId, isNew } = getOrCreateSession(req);
  if (isNew) setSessionCookie(res, sessionId);

  const token = await getValidAccessToken(sessionId);
  res.status(200).json({ connected: Boolean(token) });
});
