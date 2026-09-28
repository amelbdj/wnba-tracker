import { withErrorHandling, methodGuard } from "./_lib/http.js";
import { getOrCreateSession, setSessionCookie } from "./_lib/session.js";
import { disconnectSession } from "./_lib/tiktokClient.js";

export default withErrorHandling(async function handler(req, res) {
  if (!methodGuard(req, res, "POST")) return;

  const { sessionId, isNew } = getOrCreateSession(req);
  if (isNew) setSessionCookie(res, sessionId);

  await disconnectSession(sessionId);
  res.status(200).json({ connected: false });
});
