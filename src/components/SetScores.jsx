import { getSetScores } from "../utils/games";

// Volleyball's per-set points ("25–22 · 18–25 · 15–13") as a row of pills —
// the set currently being played (while live) is highlighted.
export default function SetScores({ competition, live = false, size = "card" }) {
  const sets = getSetScores(competition);
  if (sets.length === 0) return null;

  return (
    <div className={`set-scores set-scores-${size}`}>
      {sets.map(([a, b], i) => {
        const current = live && i === sets.length - 1;
        const won = !current && a !== b ? (a > b ? "a" : "b") : null;
        return (
          <span key={i} className={`set-pill${current ? " is-current" : ""}`}>
            <span className={won === "a" ? "set-won" : ""}>{a}</span>
            <span className="set-sep">–</span>
            <span className={won === "b" ? "set-won" : ""}>{b}</span>
          </span>
        );
      })}
    </div>
  );
}
