import { decrypt, encrypt } from "./crypto.js";
import { getEnv } from "./env.js";
import { getRedis, TOKENS_KEY } from "./redis.js";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const API_ROOT = "https://open.tiktokapis.com/v2";

// A little slack before the real expiry so we never hand out a token that
// dies mid-request.
const EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;

async function postForm(url, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  return { ok: res.ok && !data.error?.code, data };
}

export async function exchangeCodeForTokens(code) {
  const { tiktokClientKey, tiktokClientSecret, tiktokRedirectUri } = getEnv();
  return postForm(TOKEN_URL, {
    client_key: tiktokClientKey,
    client_secret: tiktokClientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirectUri,
  });
}

async function refreshTokens(refreshToken) {
  const { tiktokClientKey, tiktokClientSecret } = getEnv();
  return postForm(TOKEN_URL, {
    client_key: tiktokClientKey,
    client_secret: tiktokClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function revokeToken(accessToken) {
  const { tiktokClientKey, tiktokClientSecret } = getEnv();
  await postForm(REVOKE_URL, {
    client_key: tiktokClientKey,
    client_secret: tiktokClientSecret,
    token: accessToken,
  });
}

export async function storeTokens(sessionId, tokenResponse) {
  const { tokenEncryptionKey } = getEnv();
  const now = Date.now();
  const record = {
    openId: tokenResponse.open_id,
    scope: tokenResponse.scope,
    accessTokenEnc: encrypt(tokenResponse.access_token, tokenEncryptionKey),
    refreshTokenEnc: encrypt(tokenResponse.refresh_token, tokenEncryptionKey),
    accessExpiresAt: now + tokenResponse.expires_in * 1000,
    refreshExpiresAt: now + tokenResponse.refresh_expires_in * 1000,
  };
  await getRedis().set(TOKENS_KEY(sessionId), record);
}

export async function disconnectSession(sessionId) {
  const redis = getRedis();
  const record = await redis.get(TOKENS_KEY(sessionId));
  if (record) {
    const { tokenEncryptionKey } = getEnv();
    try {
      await revokeToken(decrypt(record.accessTokenEnc, tokenEncryptionKey));
    } catch {
      // Best-effort: still forget the tokens locally even if TikTok's
      // revoke call fails (e.g. token already expired).
    }
  }
  await redis.del(TOKENS_KEY(sessionId));
}

// Returns { accessToken, openId } for a session with a still-usable TikTok
// connection, refreshing the access token first if it's close to expiry —
// or null if the session has never connected or its refresh token has
// also expired (the user needs to reconnect).
export async function getValidAccessToken(sessionId) {
  const redis = getRedis();
  const record = await redis.get(TOKENS_KEY(sessionId));
  if (!record) return null;

  const { tokenEncryptionKey } = getEnv();
  const now = Date.now();

  if (record.accessExpiresAt - now > EXPIRY_SAFETY_MARGIN_MS) {
    return { accessToken: decrypt(record.accessTokenEnc, tokenEncryptionKey), openId: record.openId };
  }

  if (record.refreshExpiresAt <= now) {
    await redis.del(TOKENS_KEY(sessionId));
    return null;
  }

  const refreshToken = decrypt(record.refreshTokenEnc, tokenEncryptionKey);
  const { ok, data } = await refreshTokens(refreshToken);
  if (!ok) {
    await redis.del(TOKENS_KEY(sessionId));
    return null;
  }

  await storeTokens(sessionId, data);
  return { accessToken: data.access_token, openId: data.open_id };
}

// Thin wrapper around TikTok's Content Posting API endpoints — always JSON
// in, JSON out, Bearer-authenticated.
export async function tiktokApiFetch(path, accessToken, body) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  return { status: res.status, ...data };
}
