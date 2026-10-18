// Each league declares which ESPN sport it lives under and which parts of the
// app its data can support, so screens adapt from this one place instead of
// checking league slugs.
//
//  - sport:      the ESPN sport segment in API URLs (…/sports/<sport>/<slug>/…)
//  - features:   players / statistics default to true. ESPN has no rosters or
//                player profiles for NCAA volleyball, so the Players screens are
//                switched off for it rather than shown empty. (Its Statistics
//                page works: player leaderboards come from NCAA.com instead.)
//  - standingsLevel: ESPN groups standings by depth; NCAA volleyball only
//                returns one flat list unless asked for conference level (3).
//  - bracket:    how to find the league's playoff games when ESPN doesn't tag
//                them as a postseason (see Bracket.jsx).

// The sports the app covers, in the order the league selector groups them.
// Adding a sport = one entry here + leagues below that point at its key.
export const SPORTS = [
  { key: "basketball", labelKey: "sport.basketball", icon: "fa-solid fa-basketball" },
  { key: "volleyball", labelKey: "sport.volleyball", icon: "fa-solid fa-volleyball" },
];

export const LEAGUES = [
  {
    slug: "wnba",
    sport: "basketball",
    labelKey: "league.wnba",
    shortLabel: "WNBA",
    icon: "fa-solid fa-basketball",
    playersMode: "aggregate",
  },
  {
    slug: "womens-college-basketball",
    sport: "basketball",
    labelKey: "league.ncaa",
    shortLabel: "NCAA Basket",
    icon: "fa-solid fa-graduation-cap",
    playersMode: "search",
  },
  {
    slug: "womens-college-volleyball",
    sport: "volleyball",
    labelKey: "league.ncaaVolleyball",
    shortLabel: "NCAA Volley",
    icon: "fa-solid fa-volleyball",
    features: { players: false },
    standingsLevel: 3,
    bracket: {
      // ESPN files the NCAA tournament under the regular season (type 2), and
      // conference tournaments carry similar headlines — only the national
      // championship's own headline identifies bracket games.
      headlinePrefix: /^NCAA Women's Volleyball Championship/i,
      // The tournament is only the last weeks of a window that starts in
      // August; scanning every day of it would be ~150 requests.
      scanLastDays: 35,
      // A 64-team single-elimination field can't be "projected" from the
      // standings the way an 8-team playoff can.
      projected: false,
    },
  },
  {
    slug: "fiba",
    sport: "basketball",
    labelKey: "league.fiba",
    shortLabel: "FIBA",
    icon: "fa-solid fa-earth-americas",
    playersMode: "aggregate",
  },
  {
    slug: "womens-olympics-basketball",
    sport: "basketball",
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

export function getSport(slug) {
  return getLeague(slug).sport;
}

export function hasFeature(slug, feature) {
  return getLeague(slug).features?.[feature] ?? true;
}
