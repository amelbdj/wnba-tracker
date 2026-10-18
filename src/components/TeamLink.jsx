import { Link, useNavigate } from "react-router-dom";

// A link to a team's page. Teams are shown inside clickable cards (a game
// card opens its stats), so the click and Enter key are stopped here instead
// of also triggering the card around the link. TBD / placeholder teams (ESPN
// gives them negative ids) get a plain element.
//
// `nested` is for teams shown inside something that is already a link (a
// player card): anchors can't nest, so it renders a span that navigates.
export default function TeamLink({ league, teamId, className, nested = false, children }) {
  const navigate = useNavigate();
  const classes = `team-link${className ? ` ${className}` : ""}`;

  if (teamId == null || Number(teamId) < 0) {
    return <span className={className}>{children}</span>;
  }

  const to = `/${league}/teams/${teamId}`;

  if (nested) {
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigate(to);
    };
    return (
      <span
        className={`${classes} team-link-nested`}
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => e.key === "Enter" && open(e)}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      to={to}
      className={classes}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}
