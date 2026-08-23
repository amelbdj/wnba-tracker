import { Link } from "react-router-dom";

export default function PlayerCard({ player, league, showTeam = true }) {
  const name = player.displayName || player.fullName;
  const teamLogo = player.team?.logos?.[0]?.href || player.team?.logo;

  return (
    <Link to={`/${league}/players/${player.id}`} className="player-card">
      <div className="player-photo-wrap">
        {player.headshot?.href ? (
          <img src={player.headshot.href} alt="" />
        ) : (
          <i className="fa-solid fa-person"></i>
        )}
      </div>

      <div className="player-card-name">{name}</div>

      <div className="player-card-meta">
        {player.position?.abbreviation && (
          <span className="position-badge">{player.position.abbreviation}</span>
        )}
        {player.jersey && <span>#{player.jersey}</span>}
      </div>

      {showTeam && player.team && (
        <div className="player-card-team">
          {teamLogo && <img src={teamLogo} alt="" />}
          <span>{player.team.abbreviation || player.team.displayName}</span>
        </div>
      )}
    </Link>
  );
}
