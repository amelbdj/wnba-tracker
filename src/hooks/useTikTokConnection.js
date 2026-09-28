import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Shared TikTok-connection state for the Settings page and the Post to
// TikTok page: whether this browser has a usable connection, the fresh
// creator_info (nickname + the account's real posting options), and
// connect/disconnect actions. All the actual API calls and token handling
// live server-side under /api/tiktok/*; this hook never sees a token.
export function useTikTokConnection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | connected | disconnected
  const [creatorInfo, setCreatorInfo] = useState(null);
  const [creatorInfoError, setCreatorInfoError] = useState(null);
  const [loadingCreatorInfo, setLoadingCreatorInfo] = useState(false);
  const [oauthNotice, setOauthNotice] = useState(null); // "connected" | "denied" | "error" | null

  const loadCreatorInfo = useCallback(async () => {
    setLoadingCreatorInfo(true);
    setCreatorInfoError(null);
    try {
      const res = await fetch("/api/tiktok/creator-info");
      if (res.status === 401) {
        setStatus("disconnected");
        setCreatorInfo(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || `HTTP ${res.status}`);
      }
      setCreatorInfo(await res.json());
    } catch (err) {
      setCreatorInfoError(err.message);
    } finally {
      setLoadingCreatorInfo(false);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/tiktok/status");
      const data = await res.json();
      setStatus(data.connected ? "connected" : "disconnected");
      return data.connected;
    } catch {
      setStatus("disconnected");
      return false;
    }
  }, []);

  useEffect(() => {
    const tiktokParam = searchParams.get("tiktok");
    if (tiktokParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOauthNotice(tiktokParam);
      const next = new URLSearchParams(searchParams);
      next.delete("tiktok");
      setSearchParams(next, { replace: true });
    }

    checkStatus().then((connected) => {
      if (connected) loadCreatorInfo();
    });
    // Only run once on mount (and once right after the OAuth redirect lands).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback((returnTo) => {
    const target = returnTo || window.location.pathname;
    window.location.href = `/api/tiktok/auth/start?return_to=${encodeURIComponent(target)}`;
  }, []);

  const disconnect = useCallback(async () => {
    await fetch("/api/tiktok/disconnect", { method: "POST" });
    setStatus("disconnected");
    setCreatorInfo(null);
  }, []);

  return {
    status, // loading | connected | disconnected
    creatorInfo,
    creatorInfoError,
    loadingCreatorInfo,
    oauthNotice,
    dismissOauthNotice: () => setOauthNotice(null),
    connect,
    disconnect,
    refreshCreatorInfo: loadCreatorInfo,
  };
}
