import { withErrorHandling, methodGuard } from "../_lib/http.js";
import { getOrCreateSession, setSessionCookie } from "../_lib/session.js";
import { getValidAccessToken, tiktokApiFetch } from "../_lib/tiktokClient.js";
import { getRedis, PUBLISH_OWNER_KEY } from "../_lib/redis.js";

export default withErrorHandling(async function handler(req, res) {
  if (!methodGuard(req, res, "GET")) return;

  const { sessionId, isNew } = getOrCreateSession(req);
  if (isNew) setSessionCookie(res, sessionId);

  const publishId = req.query.publish_id;
  if (typeof publishId !== "string" || !publishId) {
    res.status(400).json({ error: "invalid_param", message: "Missing publish_id." });
    return;
  }

  // Only the session that started this publish can poll its status.
  const owner = await getRedis().get(PUBLISH_OWNER_KEY(publishId));
  if (owner !== sessionId) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const token = await getValidAccessToken(sessionId);
  if (!token) {
    res.status(401).json({ error: "not_connected" });
    return;
  }

  const result = await tiktokApiFetch("/post/publish/status/fetch/", token.accessToken, { publish_id: publishId });
  if (result.error && result.error.code !== "ok") {
    res.status(result.status === 200 ? 502 : result.status).json({ error: result.error.code, message: result.error.message });
    return;
  }

  res.status(200).json(result.data);
});
