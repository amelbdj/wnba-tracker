import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import StandingsPage from "./pages/StandingsPage";

function App() {
  return (
    <>
      <Header />
      <div className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/standings" element={<StandingsPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
