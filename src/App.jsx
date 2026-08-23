import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import StandingsPage from "./pages/StandingsPage";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import PlayersPage from "./pages/PlayersPage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import StatisticsPage from "./pages/StatisticsPage";
import { DEFAULT_LEAGUE } from "./leagues";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${DEFAULT_LEAGUE}`} replace />} />
      <Route path="/:league" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="standings" element={<StandingsPage />} />
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
