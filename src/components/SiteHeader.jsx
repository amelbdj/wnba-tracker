import { Link } from "react-router-dom";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import InstagramLink from "./InstagramLink";
import TikTokLink from "./TikTokLink";

export default function SiteHeader({ cta }) {
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
          <InstagramLink />
          <TikTokLink />
          <LanguageSwitcher />
          {cta}
        </div>
      </div>
    </header>
  );
}
