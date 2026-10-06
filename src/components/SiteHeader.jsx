import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import InstagramLink from "./InstagramLink";
import TikTokLink from "./TikTokLink";

export default function SiteHeader({ cta }) {
  const { t } = useTranslation();

  return (
    <header className="site-header landing-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <Logo size={30} />
          <span className="brand-text">
            FRONTROW
            <small>The home of women's sports.</small>
          </span>
        </Link>

        <div className="header-right">
          <InstagramLink className="header-extra" />
          <TikTokLink className="header-extra" />
          <Link to="/settings" className="icon-btn header-extra" aria-label={t("nav.settings")}>
            <i className="fa-solid fa-gear"></i>
          </Link>
          <LanguageSwitcher />
          {cta}
        </div>
      </div>
    </header>
  );
}
