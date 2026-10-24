import { Suspense, useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import Header from "./Header";
import SiteFooter from "./SiteFooter";
import { LEAGUES, hasFeature } from "../leagues";
import { getLastLeague, rememberLeague } from "../utils/lastLeague";

// Sections that depend on a feature some leagues don't have data for.
const SECTION_FEATURE = { players: "players", statistics: "statistics" };

export default function Layout() {
  const { league } = useParams();
  const { pathname } = useLocation();
  const isValid = LEAGUES.some((l) => l.slug === league);

  useEffect(() => {
    if (isValid) rememberLeague(league);
  }, [isValid, league]);

  if (!isValid) {
    return <Navigate to={`/${getLastLeague()}`} replace />;
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
        <Suspense
          fallback={
            <div className="container-wide">
              <div className="skeleton skeleton-card" style={{ height: 220 }}></div>
            </div>
          }
        >
          <Outlet />
        </Suspense>
        <SiteFooter />
      </div>
    </>
  );
}
