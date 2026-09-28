import { withErrorHandling, methodGuard } from "./_lib/http.js";
import { getOrCreateSession, setSessionCookie } from "./_lib/session.js";
import { getValidAccessToken, tiktokApiFetch } from "./_lib/tiktokClient.js";

// Proxies creator_info/query. The response — nickname, which privacy
// levels this creator is allowed to use, whether comments/duet/stitch are
// disabled at the account level, max post duration — is exactly what the
// frontend needs to build its posting form without hardcoding any option,
// per TikTok's Content Sharing Guidelines ("must retrieve latest creator
// info when rendering the posting interface").
export default withErrorHandling(async function handler(req, res) {
  if (!methodGuard(req, res, "GET")) return;

  const { sessionId, isNew } = getOrCreateSession(req);
  if (isNew) setSessionCookie(res, sessionId);

  const token = await getValidAccessToken(sessionId);
  if (!token) {
    res.status(401).json({ error: "not_connected" });
    return;
  }

  const result = await tiktokApiFetch("/post/publish/creator_info/query/", token.accessToken);
  if (result.error && result.error.code !== "ok") {
    res.status(result.status === 200 ? 502 : result.status).json({ error: result.error.code, message: result.error.message });
    return;
  }

  res.status(200).json(result.data);
});
