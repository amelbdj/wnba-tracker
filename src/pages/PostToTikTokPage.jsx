import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import TikTokConnectCard from "../components/tiktok/TikTokConnectCard";
import VideoPicker from "../components/tiktok/VideoPicker";
import PublishProgress from "../components/tiktok/PublishProgress";
import { useTikTokConnection } from "../hooks/useTikTokConnection";
import { computeChunkPlan, uploadVideoToTikTok } from "../utils/tiktokUpload";
import { tiktokErrorKey } from "../utils/tiktokErrors";

const PRIVACY_LEVELS = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"];
const MUSIC_USAGE_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_CONTENT_POLICY_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";
const STATUS_POLL_INTERVAL_MS = 3000;
const STATUS_POLL_MAX_ATTEMPTS = 40; // ~2 minutes

export default function PostToTikTokPage() {
  const { t } = useTranslation();
  const connection = useTikTokConnection();
  const { status, creatorInfo, loadingCreatorInfo, creatorInfoError, oauthNotice, dismissOauthNotice, connect, disconnect } =
    connection;

  const [videoFile, setVideoFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState("");
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [commercialEnabled, setCommercialEnabled] = useState(false);
  const [brandOrganicToggle, setBrandOrganicToggle] = useState(false);
  const [brandContentToggle, setBrandContentToggle] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const [phase, setPhase] = useState("editing"); // editing | uploading | processing | success | failed
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishStatus, setPublishStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const pollTimeoutRef = useRef(null);

  const availablePrivacyLevels = creatorInfo?.privacy_level_options || [];
  const commentsBlockedByAccount = Boolean(creatorInfo?.comment_disabled);
  const duetBlockedByAccount = Boolean(creatorInfo?.duet_disabled);
  const stitchBlockedByAccount = Boolean(creatorInfo?.stitch_disabled);

  const brandedPrivacyConflict = brandContentToggle && privacyLevel === "SELF_ONLY";
  const commercialMissingChoice = commercialEnabled && !brandOrganicToggle && !brandContentToggle;

  const canPublish =
    status === "connected" &&
    videoFile &&
    privacyLevel &&
    !commercialMissingChoice &&
    !brandedPrivacyConflict &&
    consentChecked &&
    phase === "editing";

  function resetForm() {
    setVideoFile(null);
    setCaption("");
    setPrivacyLevel("");
    setDisableComment(false);
    setDisableDuet(false);
    setDisableStitch(false);
    setCommercialEnabled(false);
    setBrandOrganicToggle(false);
    setBrandContentToggle(false);
    setConsentChecked(false);
    setPhase("editing");
    setUploadProgress(0);
    setPublishStatus(null);
    setErrorMessage(null);
  }

  function stopPolling() {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }

  function pollStatus(publishId, attempt = 0) {
    stopPolling();
    pollTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tiktok/publish/status?publish_id=${encodeURIComponent(publishId)}`);
        const data = await res.json();
        if (!res.ok) {
          setPhase("failed");
          setErrorMessage(t(tiktokErrorKey(data.error), { defaultValue: data.message || data.error }));
          return;
        }

        setPublishStatus(data);

        if (data.status === "PUBLISH_COMPLETE" || data.status === "SEND_TO_USER_INBOX") {
          setPhase("success");
          return;
        }
        if (data.status === "FAILED") {
          setPhase("failed");
          setErrorMessage(data.fail_reason || null);
          return;
        }
        if (attempt + 1 >= STATUS_POLL_MAX_ATTEMPTS) {
          setPhase("failed");
          setErrorMessage(t("postToTikTok.stillProcessing"));
          return;
        }
        pollStatus(publishId, attempt + 1);
      } catch {
        setPhase("failed");
        setErrorMessage(t("tiktokErrors.generic"));
      }
    }, STATUS_POLL_INTERVAL_MS);
  }

  async function handlePublish() {
    if (!canPublish) return;
    setPhase("uploading");
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const { chunkSize, totalChunkCount } = computeChunkPlan(videoFile.size);
      const initRes = await fetch("/api/tiktok/publish/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: caption,
          privacyLevel,
          disableComment,
          disableDuet,
          disableStitch,
          brandContentToggle,
          brandOrganicToggle,
          videoSize: videoFile.size,
          chunkSize,
          totalChunkCount,
        }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) {
        setPhase("failed");
        setErrorMessage(t(tiktokErrorKey(initData.error), { defaultValue: initData.message || initData.error }));
        return;
      }

      await uploadVideoToTikTok(videoFile, initData.uploadUrl, { chunkSize, totalChunkCount }, setUploadProgress);

      setPhase("processing");
      pollStatus(initData.publishId);
    } catch (err) {
      setPhase("failed");
      setErrorMessage(err.message || t("tiktokErrors.generic"));
    }
  }

  const captionCount = useMemo(() => caption.length, [caption]);

  return (
    <>
      <SiteHeader />
      <div className="page">
        <div className="container tiktok-post-page">
          <div className="page-title" style={{ marginTop: 20 }}>
            <span className="badge-icon">
              <i className="fa-brands fa-tiktok"></i>
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{t("postToTikTok.title")}</h1>
          </div>
          <p className="page-subtitle">{t("postToTikTok.subtitle")}</p>

          <TikTokConnectCard
            status={status}
            creatorInfo={creatorInfo}
            loadingCreatorInfo={loadingCreatorInfo}
            creatorInfoError={creatorInfoError}
            oauthNotice={oauthNotice}
            onDismissNotice={dismissOauthNotice}
            onConnect={() => connect("/post-to-tiktok")}
            onDisconnect={disconnect}
          />

          {status === "disconnected" && (
            <div className="empty-state tiktok-connect-prompt">
              <i className="fa-brands fa-tiktok"></i>
              <strong>{t("postToTikTok.connectPrompt")}</strong>
            </div>
          )}

          {status === "connected" && creatorInfo && phase === "editing" && (
            <div className="tiktok-post-form">
              {creatorInfo.creator_nickname && (
                <p className="tiktok-posting-as">
                  <i className="fa-solid fa-circle-info"></i>{" "}
                  {t("postToTikTok.postingAs", { name: creatorInfo.creator_nickname })}
                </p>
              )}

              {availablePrivacyLevels.length === 1 && availablePrivacyLevels[0] === "SELF_ONLY" && (
                <p className="tiktok-sandbox-notice">
                  <i className="fa-solid fa-flask"></i> {t("postToTikTok.sandboxNotice")}
                </p>
              )}

              <section className="tiktok-form-section">
                <h2>{t("postToTikTok.chooseVideo")}</h2>
                <VideoPicker
                  maxDurationSec={creatorInfo.max_video_post_duration_sec}
                  onVideoSelected={(confirmed) => setVideoFile(confirmed)}
                />
                {creatorInfo.max_video_post_duration_sec && (
                  <p className="tiktok-field-hint">
                    {t("postToTikTok.maxDurationNote", { max: Math.round(creatorInfo.max_video_post_duration_sec) })}
                  </p>
                )}
              </section>

              <section className="tiktok-form-section">
                <h2>{t("postToTikTok.captionLabel")}</h2>
                <textarea
                  className="tiktok-caption-input"
                  value={caption}
                  maxLength={2200}
                  placeholder={t("postToTikTok.captionPlaceholder")}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                />
                <p className="tiktok-field-hint tiktok-caption-count">
                  {t("postToTikTok.captionCount", { count: captionCount })}
                </p>
              </section>

              <section className="tiktok-form-section">
                <h2>{t("postToTikTok.privacyLabel")}</h2>
                <select
                  className="tiktok-select"
                  value={privacyLevel}
                  onChange={(e) => setPrivacyLevel(e.target.value)}
                >
                  <option value="" disabled>
                    {t("postToTikTok.privacyPlaceholder")}
                  </option>
                  {PRIVACY_LEVELS.filter((level) => availablePrivacyLevels.includes(level)).map((level) => (
                    <option key={level} value={level} disabled={brandContentToggle && level === "SELF_ONLY"}>
                      {t(`postToTikTok.privacyLevel.${level}`)}
                    </option>
                  ))}
                </select>
                {brandedPrivacyConflict && (
                  <p className="tiktok-field-error">{t("postToTikTok.commercialPrivacyConflict")}</p>
                )}
              </section>

              <section className="tiktok-form-section">
                <h2>{t("postToTikTok.interactionsLabel")}</h2>
                <label className="tiktok-checkbox-row">
                  <input
                    type="checkbox"
                    checked={disableComment}
                    disabled={commentsBlockedByAccount}
                    onChange={(e) => setDisableComment(e.target.checked)}
                  />
                  <span>{t("postToTikTok.disableComment")}</span>
                  {commentsBlockedByAccount && (
                    <span className="tiktok-checkbox-note">{t("postToTikTok.disabledByAccount")}</span>
                  )}
                </label>
                <label className="tiktok-checkbox-row">
                  <input
                    type="checkbox"
                    checked={disableDuet}
                    disabled={duetBlockedByAccount}
                    onChange={(e) => setDisableDuet(e.target.checked)}
                  />
                  <span>{t("postToTikTok.disableDuet")}</span>
                  {duetBlockedByAccount && (
                    <span className="tiktok-checkbox-note">{t("postToTikTok.disabledByAccount")}</span>
                  )}
                </label>
                <label className="tiktok-checkbox-row">
                  <input
                    type="checkbox"
                    checked={disableStitch}
                    disabled={stitchBlockedByAccount}
                    onChange={(e) => setDisableStitch(e.target.checked)}
                  />
                  <span>{t("postToTikTok.disableStitch")}</span>
                  {stitchBlockedByAccount && (
                    <span className="tiktok-checkbox-note">{t("postToTikTok.disabledByAccount")}</span>
                  )}
                </label>
              </section>

              <section className="tiktok-form-section">
                <h2>{t("postToTikTok.commercialLabel")}</h2>
                <label className="tiktok-checkbox-row">
                  <input
                    type="checkbox"
                    checked={commercialEnabled}
                    onChange={(e) => {
                      setCommercialEnabled(e.target.checked);
                      if (!e.target.checked) {
                        setBrandOrganicToggle(false);
                        setBrandContentToggle(false);
                      }
                    }}
                  />
                  <span>{t("postToTikTok.commercialToggle")}</span>
                </label>

                {commercialEnabled && (
                  <div className="tiktok-commercial-options">
                    <label className="tiktok-checkbox-row">
                      <input
                        type="checkbox"
                        checked={brandOrganicToggle}
                        onChange={(e) => setBrandOrganicToggle(e.target.checked)}
                      />
                      <span>{t("postToTikTok.commercialYourBrand")}</span>
                    </label>
                    <label className="tiktok-checkbox-row">
                      <input
                        type="checkbox"
                        checked={brandContentToggle}
                        onChange={(e) => setBrandContentToggle(e.target.checked)}
                      />
                      <span>{t("postToTikTok.commercialBrandedContent")}</span>
                    </label>
                    {commercialMissingChoice && (
                      <p className="tiktok-field-error">{t("postToTikTok.commercialRequireOne")}</p>
                    )}
                  </div>
                )}
              </section>

              <section className="tiktok-form-section tiktok-legal-section">
                <p>
                  {brandContentToggle
                    ? t("postToTikTok.declarationBrandedContent")
                    : brandOrganicToggle
                      ? t("postToTikTok.declarationBrandOnly")
                      : t("postToTikTok.declarationDefault")}
                </p>
                <div className="tiktok-legal-links">
                  <a href={MUSIC_USAGE_URL} target="_blank" rel="noopener noreferrer">
                    {t("postToTikTok.musicUsageLink")}
                  </a>
                  {brandContentToggle && (
                    <a href={BRANDED_CONTENT_POLICY_URL} target="_blank" rel="noopener noreferrer">
                      {t("postToTikTok.brandedContentPolicyLink")}
                    </a>
                  )}
                </div>
                <label className="tiktok-checkbox-row tiktok-consent-row">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                  />
                  <span>{t("postToTikTok.consentLabel")}</span>
                </label>
              </section>

              <button className="btn btn-primary tiktok-publish-btn" disabled={!canPublish} onClick={handlePublish}>
                <i className="fa-brands fa-tiktok"></i> {t("postToTikTok.publish")}
              </button>
            </div>
          )}

          {(phase === "uploading" || phase === "processing" || phase === "success" || phase === "failed") && (
            <>
              <PublishProgress
                phase={phase}
                uploadProgress={uploadProgress}
                publishStatus={publishStatus}
                errorMessage={errorMessage}
              />
              {(phase === "success" || phase === "failed") && (
                <button className="btn btn-ghost" onClick={resetForm}>
                  {t("postToTikTok.postAnother")}
                </button>
              )}
            </>
          )}
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
