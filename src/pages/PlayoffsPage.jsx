import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Bracket from "../components/Bracket";
import { getLeague } from "../leagues";

export default function PlayoffsPage() {
  const { t } = useTranslation();
  const { league } = useParams();
  const leagueLabel = t(getLeague(league).labelKey);

  return (
    <div className="container-wide">
      <Link to={`/${league}`} className="nav-btn">
        <i className="fa-solid fa-arrow-left"></i> {t("common.backToDashboard")}
      </Link>

      <div className="page-title" style={{ marginTop: 20 }}>
        <span className="badge-icon">
          <i className="fa-solid fa-trophy"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          {t("nav.playoffs")} {leagueLabel}
        </h1>
      </div>
      <p className="page-subtitle">{t("playoffs.subtitle")}</p>

      <Bracket league={league} />
    </div>
  );
}
