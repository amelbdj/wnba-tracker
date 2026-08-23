import { Link, useParams } from "react-router-dom";
import Standings from "../components/Standings";
import { getLeague } from "../leagues";

export default function StandingsPage() {
  const { league } = useParams();
  const leagueLabel = getLeague(league).label;

  return (
    <div className="container">
      <Link to={`/${league}`} className="nav-btn">
        <i className="fa-solid fa-arrow-left"></i> Retour au dashboard
      </Link>

      <div className="page-title" style={{ marginTop: 20 }}>
        <span className="badge-icon">
          <i className="fa-solid fa-ranking-star"></i>
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Classement {leagueLabel}</h1>
      </div>
      <p className="page-subtitle">Le classement complet de la ligue, mis à jour en direct.</p>

      <Standings league={league} grouped />
    </div>
  );
}
