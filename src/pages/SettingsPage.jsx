import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import TikTokConnectCard from "../components/tiktok/TikTokConnectCard";
import { useTikTokConnection } from "../hooks/useTikTokConnection";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { status, creatorInfo, loadingCreatorInfo, creatorInfoError, oauthNotice, dismissOauthNotice, connect, disconnect } =
    useTikTokConnection();

  return (
    <>
      <SiteHeader />
      <div className="page">
        <div className="container">
          <div className="page-title" style={{ marginTop: 20 }}>
            <span className="badge-icon">
              <i className="fa-solid fa-gear"></i>
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{t("settings.title")}</h1>
          </div>
          <p className="page-subtitle">{t("settings.subtitle")}</p>

          <div className="section">
            <div className="section-head">
              <div className="section-title">{t("settings.connectedAccounts")}</div>
            </div>

            <TikTokConnectCard
              status={status}
              creatorInfo={creatorInfo}
              loadingCreatorInfo={loadingCreatorInfo}
              creatorInfoError={creatorInfoError}
              oauthNotice={oauthNotice}
              onDismissNotice={dismissOauthNotice}
              onConnect={() => connect("/settings")}
              onDisconnect={disconnect}
            />

            {status === "connected" && (
              <Link to="/post-to-tiktok" className="btn btn-primary" style={{ marginTop: 16 }}>
                <i className="fa-brands fa-tiktok"></i> {t("settings.postVideo")}
              </Link>
            )}
          </div>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
