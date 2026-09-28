import { useTranslation } from "react-i18next";

export default function TikTokConnectCard({
  status,
  creatorInfo,
  loadingCreatorInfo,
  creatorInfoError,
  oauthNotice,
  onDismissNotice,
  onConnect,
  onDisconnect,
}) {
  const { t } = useTranslation();

  return (
    <div className="tiktok-connect-card">
      {oauthNotice && (
        <div className={`tiktok-oauth-notice tiktok-oauth-notice-${oauthNotice}`}>
          <i
            className={`fa-solid ${oauthNotice === "connected" ? "fa-circle-check" : "fa-triangle-exclamation"}`}
          ></i>
          <span>{t(`tiktokConnect.oauthNotice.${oauthNotice}`)}</span>
          <button className="icon-btn tiktok-oauth-notice-close" onClick={onDismissNotice} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      <div className="tiktok-connect-row">
        <div className="tiktok-connect-icon">
          <i className="fa-brands fa-tiktok"></i>
        </div>

        <div className="tiktok-connect-info">
          <div className="tiktok-connect-title">TikTok</div>

          {status === "loading" && <div className="tiktok-connect-subtitle">{t("tiktokConnect.checking")}</div>}

          {status === "disconnected" && (
            <div className="tiktok-connect-subtitle">{t("tiktokConnect.notConnected")}</div>
          )}

          {status === "connected" && (
            <div className="tiktok-connect-subtitle tiktok-connect-subtitle-connected">
              <span className="tiktok-connect-dot"></span>
              {loadingCreatorInfo
                ? t("tiktokConnect.loadingAccount")
                : creatorInfo?.creator_nickname
                  ? t("tiktokConnect.connectedAs", { name: creatorInfo.creator_nickname })
                  : t("tiktokConnect.connected")}
            </div>
          )}

          {creatorInfoError && <div className="tiktok-connect-error">{creatorInfoError}</div>}
        </div>

        {status === "connected" ? (
          <button className="btn btn-ghost" onClick={onDisconnect}>
            {t("tiktokConnect.disconnect")}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onConnect} disabled={status === "loading"}>
            <i className="fa-brands fa-tiktok"></i> {t("tiktokConnect.connect")}
          </button>
        )}
      </div>
    </div>
  );
}
