import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import InstagramLink from "./InstagramLink";
import TikTokLink from "./TikTokLink";

export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="landing-footer">
      <Logo size={26} />
      <div>
        <div className="landing-footer-brand">FRONTROW</div>
        <div className="landing-footer-note">{t("landing.footerNote")}</div>
      </div>

      <nav className="footer-legal-links">
        <Link to="/privacy">{t("footer.privacy")}</Link>
        <Link to="/terms">{t("footer.terms")}</Link>
      </nav>

      <div className="footer-social-links">
        <InstagramLink />
        <TikTokLink />
      </div>
    </footer>
  );
}
