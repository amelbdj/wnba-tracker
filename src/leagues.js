export const LEAGUES = [
  {
    slug: "wnba",
    labelKey: "league.wnba",
    shortLabel: "WNBA",
    icon: "fa-solid fa-basketball",
    playersMode: "aggregate",
  },
  {
    slug: "womens-college-basketball",
    labelKey: "league.ncaa",
    shortLabel: "NCAA",
    icon: "fa-solid fa-graduation-cap",
    playersMode: "search",
  },
  {
    slug: "fiba",
    labelKey: "league.fiba",
    shortLabel: "FIBA",
    icon: "fa-solid fa-earth-americas",
    playersMode: "aggregate",
  },
  {
    slug: "womens-olympics-basketball",
    labelKey: "league.olympics",
    shortLabel: "JO",
    icon: "fa-solid fa-medal",
    playersMode: "aggregate",
  },
];

export const DEFAULT_LEAGUE = "wnba";

export function getLeague(slug) {
  return LEAGUES.find((l) => l.slug === slug) || LEAGUES[0];
}
