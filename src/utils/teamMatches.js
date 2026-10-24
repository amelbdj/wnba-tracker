import { getGameStatus } from "./games";

const scoreOf = (c) => Number(c.score?.displayValue ?? c.score) || 0;

// One ESPN schedule event, seen from `teamId`'s side: { id, date, state:
// final | live | upcoming | other, home, opponent, score: [us, them], won, ... }.
export function toMatch(event, teamId, t) {
  const comp = event.competitions?.[0];
  const side = comp?.competitors?.findIndex((c) => String(c.team.id) === String(teamId));
  if (!comp || side == null || side < 0) return null;

  const us = comp.competitors[side];
  const them = comp.competitors[1 - side];
  const type = comp.status?.type || {};
  const state = type.completed ? "final" : type.state === "in" ? "live" : type.state === "pre" ? "upcoming" : "other";

  return {
    id: event.id,
    date: event.date,
    state,
    status: comp.status,
    // "Postponed", "Canceled"… for matches that were never played.
    note: state === "other" ? getGameStatus({ status: comp.status }, t).label : null,
    // ESPN season types: 1 preseason, 2 regular season, 3 postseason.
    phase: { 1: "preseason", 3: "postseason" }[Number(event.seasonType?.type ?? event.seasonType?.id)] || null,
    home: us.homeAway === "home",
    neutral: Boolean(comp.neutralSite),
    opponent: { ...them.team, logo: them.team.logos?.[0]?.href || them.team.logo },
    score: [scoreOf(us), scoreOf(them)],
    won: scoreOf(us) > scoreOf(them),
  };
}
