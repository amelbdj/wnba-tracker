import { Link } from "react-router-dom";
import { getStat } from "../utils/stats";

export default function TeamCard({ entry, conferenceAbbr, index, league }) {
  const team = entry.team;
  const wins = getStat(entry, "wins")?.value ?? 0;
  const losses = getStat(entry, "losses")?.value ?? 0;
  const seedStat = getStat(entry, "playoffSeed");
  const seed = seedStat?.displayValue || index + 1;
  const winPercentStat = getStat(entry, "winPercent");
  const pct =
    winPercentStat?.value != null
      ? winPercentStat.value * 100
      : wins + losses > 0
        ? (wins / (wins + losses)) * 100
        : 0;

  return (
    <Link to={`/${league}/teams/${team.id}`} className="team-card">
      <div className="team-card-top">
        <span className="rank-badge">{seed}</span>
        {conferenceAbbr && <span className="team-card-conf">{conferenceAbbr}</span>}
      </div>

      <img src={team.logos?.[0]?.href} alt="" className="team-card-logo" />

      <div className="team-card-name">{team.displayName}</div>
      <div className="team-card-record">
        {wins}-{losses}
      </div>

      <div className="team-card-foot">
        <span className="team-card-pct">{pct.toFixed(0)}% V</span>
      </div>
    </Link>
  );
}
