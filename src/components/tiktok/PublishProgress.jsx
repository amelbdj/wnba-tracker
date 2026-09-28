import { useTranslation } from "react-i18next";

// Renders the three states TikTok's guidelines require after the user taps
// "Publish": an upload progress bar, a "processing" state while we poll
// publish/status/fetch, and a clear final success/failure state.
export default function PublishProgress({ phase, uploadProgress, publishStatus, errorMessage }) {
  const { t } = useTranslation();

  if (phase === "uploading") {
    const percent = Math.round(uploadProgress * 100);
    return (
      <div className="tiktok-progress-card">
        <div className="tiktok-progress-label">
          <i className="fa-solid fa-arrow-up-from-bracket"></i> {t("postToTikTok.uploading", { percent })}
        </div>
        <div className="tiktok-progress-track">
          <div className="tiktok-progress-fill" style={{ width: `${percent}%` }}></div>
        </div>
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="tiktok-progress-card">
        <div className="tiktok-progress-label">
          <span className="tiktok-spinner"></span> {t("postToTikTok.processing")}
        </div>
        <p className="tiktok-progress-hint">{t("postToTikTok.processingHint")}</p>
        {publishStatus?.status && <p className="tiktok-progress-status-code">{publishStatus.status}</p>}
      </div>
    );
  }

  if (phase === "success") {
    const sentToInbox = publishStatus?.status === "SEND_TO_USER_INBOX";
    return (
      <div className="tiktok-progress-card tiktok-progress-success">
        <div className="tiktok-progress-label">
          <i className="fa-solid fa-circle-check"></i>{" "}
          {sentToInbox ? t("postToTikTok.sentToInbox") : t("postToTikTok.published")}
        </div>
        <p className="tiktok-progress-hint">
          {sentToInbox ? t("postToTikTok.sentToInboxHint") : t("postToTikTok.publishedHint")}
        </p>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="tiktok-progress-card tiktok-progress-failed">
        <div className="tiktok-progress-label">
          <i className="fa-solid fa-triangle-exclamation"></i> {t("postToTikTok.failed")}
        </div>
        {errorMessage && <p className="tiktok-progress-hint">{errorMessage}</p>}
      </div>
    );
  }

  return null;
}
