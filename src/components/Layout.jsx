import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import Header from "./Header";
import SiteFooter from "./SiteFooter";
import { DEFAULT_LEAGUE, LEAGUES, hasFeature } from "../leagues";

// Sections that depend on a feature some leagues don't have data for.
const SECTION_FEATURE = { players: "players", statistics: "statistics" };

export default function Layout() {
  const { league } = useParams();
  const { pathname } = useLocation();
  const isValid = LEAGUES.some((l) => l.slug === league);

  if (!isValid) {
    return <Navigate to={`/${DEFAULT_LEAGUE}`} replace />;
  }

  // e.g. /womens-college-volleyball/players — ESPN has no player data for it.
  const section = pathname.split("/")[2];
  const feature = SECTION_FEATURE[section];
  if (feature && !hasFeature(league, feature)) {
    return <Navigate to={`/${league}`} replace />;
  }

  return (
    <>
      <Header />
      <div className="page">
        <Outlet />
        <SiteFooter />
      </div>
    </>
  );
}
