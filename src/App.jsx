import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import GlobalSearch from "./components/GlobalSearch";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import SettingsPage from "./pages/SettingsPage";
import PostToTikTokPage from "./pages/PostToTikTokPage";

// League pages load on demand, so the first visit doesn't download the
// bracket, statistics and player code it may never open (Layout shows the
// placeholder while one loads).
const Home = lazy(() => import("./pages/Home"));
const StandingsPage = lazy(() => import("./pages/StandingsPage"));
const TeamsPage = lazy(() => import("./pages/TeamsPage"));
const TeamDetailPage = lazy(() => import("./pages/TeamDetailPage"));
const PlayersPage = lazy(() => import("./pages/PlayersPage"));
const PlayerProfilePage = lazy(() => import("./pages/PlayerProfilePage"));
const VolleyballPlayerPage = lazy(() => import("./pages/VolleyballPlayerPage"));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage"));
const PlayoffsPage = lazy(() => import("./pages/PlayoffsPage"));

function App() {
  return (
    <>
      <GlobalSearch />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/post-to-tiktok" element={<PostToTikTokPage />} />
        <Route path="/:league" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="playoffs" element={<PlayoffsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:teamId" element={<TeamDetailPage />} />
          <Route path="teams/:teamId/players/:slug" element={<VolleyballPlayerPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:playerId" element={<PlayerProfilePage />} />
          <Route path="statistics" element={<StatisticsPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
