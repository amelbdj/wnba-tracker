import { withErrorHandling, methodGuard } from "../_lib/http.js";
import { getOrCreateSession, setSessionCookie } from "../_lib/session.js";
import { getValidAccessToken, tiktokApiFetch } from "../_lib/tiktokClient.js";
import { getRedis, PUBLISH_OWNER_KEY, PUBLISH_OWNER_TTL_SECONDS } from "../_lib/redis.js";

const VALID_PRIVACY_LEVELS = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
];

export default withErrorHandling(async function handler(req, res) {
  if (!methodGuard(req, res, "POST")) return;

  const { sessionId, isNew } = getOrCreateSession(req);
  if (isNew) setSessionCookie(res, sessionId);

  const token = await getValidAccessToken(sessionId);
  if (!token) {
    res.status(401).json({ error: "not_connected" });
    return;
  }

  const {
    title,
    privacyLevel,
    disableComment,
    disableDuet,
    disableStitch,
    brandContentToggle,
    brandOrganicToggle,
    videoSize,
    chunkSize,
    totalChunkCount,
  } = req.body ?? {};

  if (!VALID_PRIVACY_LEVELS.includes(privacyLevel)) {
    res.status(400).json({ error: "invalid_param", message: "Missing or invalid privacyLevel." });
    return;
  }
  if (!Number.isFinite(videoSize) || !Number.isFinite(chunkSize) || !Number.isFinite(totalChunkCount)) {
    res.status(400).json({ error: "invalid_param", message: "Missing video size/chunk plan." });
    return;
  }

  // Re-check against TikTok's own creator_info right before publishing —
  // options the frontend rendered a minute ago (privacy levels, whether
  // comments/duet/stitch are disabled at the account level) could be stale,
  // and TikTok's guidelines call for using the latest values.
  const creatorInfo = await tiktokApiFetch("/post/publish/creator_info/query/", token.accessToken);
  if (creatorInfo.error && creatorInfo.error.code !== "ok") {
    res.status(502).json({ error: creatorInfo.error.code, message: creatorInfo.error.message });
    return;
  }

  const allowedLevels = creatorInfo.data.privacy_level_options || [];
  if (!allowedLevels.includes(privacyLevel)) {
    res.status(400).json({ error: "privacy_level_option_mismatch", message: "That privacy option is no longer available for this account." });
    return;
  }
  if (brandContentToggle && privacyLevel === "SELF_ONLY") {
    res.status(400).json({ error: "invalid_param", message: "Branded content can't be posted as private." });
    return;
  }

  const postInfo = {
    title: typeof title === "string" ? title.slice(0, 2200) : "",
    privacy_level: privacyLevel,
    disable_comment: creatorInfo.data.comment_disabled ? true : Boolean(disableComment),
    disable_duet: creatorInfo.data.duet_disabled ? true : Boolean(disableDuet),
    disable_stitch: creatorInfo.data.stitch_disabled ? true : Boolean(disableStitch),
    brand_content_toggle: Boolean(brandContentToggle),
    brand_organic_toggle: Boolean(brandOrganicToggle),
  };

  const result = await tiktokApiFetch("/post/publish/video/init/", token.accessToken, {
    post_info: postInfo,
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount,
    },
  });

  if (result.error && result.error.code !== "ok") {
    res.status(result.status === 200 ? 502 : result.status).json({ error: result.error.code, message: result.error.message });
    return;
  }

  await getRedis().set(PUBLISH_OWNER_KEY(result.data.publish_id), sessionId, { ex: PUBLISH_OWNER_TTL_SECONDS });

  res.status(200).json({ publishId: result.data.publish_id, uploadUrl: result.data.upload_url });
});
