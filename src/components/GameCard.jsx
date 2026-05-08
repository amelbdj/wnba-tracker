export default function GameCard({ game }) {
  const comp = game.competitions[0];

  const team1 = comp.competitors[0];
  const team2 = comp.competitors[1];

  const status = game.status.type.description;
  const isLive = status === "In Progress";

  const time = new Date(game.date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="card">
      {/* teams */}
      <div className="team">
        <div className="team-row">
          <img src={team1.team.logo} />
          <span>{team1.team.displayName}</span>
        </div>

        <div className="team-row">
          <img src={team2.team.logo} />
          <span>{team2.team.displayName}</span>
        </div>
      </div>

      {/* score + time */}
      <div className="middle">
        <div className="score">
          {team1.score} - {team2.score}
        </div>

        <div className="time">
          <i className="fa-regular fa-clock"></i> {time}
        </div>
      </div>

      {/* status */}
      <div className="status">
        {isLive ? (
          <span className="live">
            <i className="fa-solid fa-circle"></i> LIVE
          </span>
        ) : (
          status
        )}
      </div>
    </div>
  );
}
