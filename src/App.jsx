import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import StandingsPage from "./pages/StandingsPage";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import PlayersPage from "./pages/PlayersPage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import StatisticsPage from "./pages/StatisticsPage";
import PlayoffsPage from "./pages/PlayoffsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import SettingsPage from "./pages/SettingsPage";
import PostToTikTokPage from "./pages/PostToTikTokPage";

function App() {
  return (
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
        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:playerId" element={<PlayerProfilePage />} />
        <Route path="statistics" element={<StatisticsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
