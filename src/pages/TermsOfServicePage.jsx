import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export default function TermsOfServicePage() {
  const { t } = useTranslation();
  const sections = t("terms.sections", { returnObjects: true });

  return (
    <>
      <SiteHeader />
      <div className="page">
        <div className="container legal-page">
          <Link to="/" className="nav-btn">
            <i className="fa-solid fa-arrow-left"></i> {t("common.backToHome")}
          </Link>

          <h1>{t("terms.title")}</h1>
          <p className="legal-updated">{t("terms.updated")}</p>

          <p>{t("terms.intro")}</p>

          {sections.map((section) => (
            <div key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
