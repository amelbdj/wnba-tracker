import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import StandingsPage from "./pages/StandingsPage";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import PlayersPage from "./pages/PlayersPage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import StatisticsPage from "./pages/StatisticsPage";

function App() {
  return (
    <>
      <Header />
      <div className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<PlayerProfilePage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
