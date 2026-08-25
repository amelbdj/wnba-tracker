import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Standings from "../components/Standings";
import { getLeague } from "../leagues";

export default function StandingsPage() {
  const { t } = useTranslation();
  const { league } = useParams();
  const leagueLabel = t(getLeague(league).labelKey);

  return (
    <div className="container">
      <Link to={`/${league}`} className="nav-btn">
        <i className="fa-solid fa-arrow-left"></i> {t("common.backToDashboard")}
      </Link>

      <div className="page-title" style={{ marginTop: 20 }}>
        <span className="badge-icon">
          <i className="fa-solid fa-ranking-star"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          {t("nav.standings")} {leagueLabel}
        </h1>
      </div>
      <p className="page-subtitle">{t("standings.subtitle")}</p>

      <Standings league={league} grouped />
    </div>
  );
}
