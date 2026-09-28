import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// Real local-file preview (an HTML5 <video> playing an object URL) — no
// fake/mocked preview. Duration is checked client-side against the
// creator's actual max_video_post_duration_sec (from creator_info) before
// the video is handed back to the parent as postable.
export default function VideoPicker({ onVideoSelected, maxDurationSec }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [durationError, setDurationError] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
    setFileName(selected.name);
    setDurationError(null);
    onVideoSelected(null, selected); // clear "confirmed" video until duration is validated
  }

  function handleLoadedMetadata(event) {
    const duration = event.target.duration;
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    if (maxDurationSec && duration > maxDurationSec) {
      setDurationError(t("postToTikTok.videoTooLong", { max: Math.round(maxDurationSec) }));
      onVideoSelected(null, file);
      return;
    }
    onVideoSelected(file, file);
  }

  return (
    <div className="tiktok-video-picker">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={handleFileChange}
        className="tiktok-file-input"
        id="tiktok-video-input"
      />

      {!previewUrl && (
        <label htmlFor="tiktok-video-input" className="tiktok-video-drop">
          <i className="fa-solid fa-film"></i>
          <span>{t("postToTikTok.chooseVideo")}</span>
          <span className="tiktok-video-drop-hint">{t("postToTikTok.videoFormats")}</span>
        </label>
      )}

      {previewUrl && (
        <div className="tiktok-video-preview">
          <video src={previewUrl} controls onLoadedMetadata={handleLoadedMetadata} />
          <div className="tiktok-video-preview-meta">
            <span className="tiktok-video-filename">
              <i className="fa-solid fa-file-video"></i> {fileName}
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
              {t("postToTikTok.changeVideo")}
            </button>
          </div>
        </div>
      )}

      {durationError && <p className="tiktok-field-error">{durationError}</p>}
    </div>
  );
}
