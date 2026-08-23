import { Navigate, Outlet, useParams } from "react-router-dom";
import Header from "./Header";
import { DEFAULT_LEAGUE, LEAGUES } from "../leagues";

export default function Layout() {
  const { league } = useParams();
  const isValid = LEAGUES.some((l) => l.slug === league);

  if (!isValid) {
    return <Navigate to={`/${DEFAULT_LEAGUE}`} replace />;
  }

  return (
    <>
      <Header />
      <div className="page">
        <Outlet />
      </div>
    </>
  );
}
