export const LEAGUES = [
  {
    slug: "wnba",
    label: "WNBA",
    shortLabel: "WNBA",
    icon: "fa-solid fa-basketball",
    playersMode: "aggregate",
  },
  {
    slug: "womens-college-basketball",
    label: "NCAA Femmes",
    shortLabel: "NCAA",
    icon: "fa-solid fa-graduation-cap",
    playersMode: "search",
  },
  {
    slug: "fiba",
    label: "FIBA",
    shortLabel: "FIBA",
    icon: "fa-solid fa-earth-americas",
    playersMode: "aggregate",
  },
  {
    slug: "womens-olympics-basketball",
    label: "Jeux Olympiques",
    shortLabel: "JO",
    icon: "fa-solid fa-medal",
    playersMode: "aggregate",
  },
];

export const DEFAULT_LEAGUE = "wnba";

export function getLeague(slug) {
  return LEAGUES.find((l) => l.slug === slug) || LEAGUES[0];
}
