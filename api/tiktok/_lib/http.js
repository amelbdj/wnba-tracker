// Wraps a Vercel Node function handler so a thrown error (e.g. a missing
// env var from env.js) becomes a clean 500 JSON response with a message in
// the function logs, instead of Vercel's generic crash page.
export function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("[tiktok]", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "server_error", message: err.message });
      }
    }
  };
}

export function methodGuard(req, res, allowed) {
  if (req.method !== allowed) {
    res.status(405).json({ error: "method_not_allowed" });
    return false;
  }
  return true;
}
