import { DEFAULT_LEAGUE, LEAGUES } from "../leagues";

// The league the visitor was last looking at, so coming back to the site (or
// pressing "Explore" on the landing page) lands there instead of always on
// the default one. This browser only.
const STORAGE_KEY = "frontrow:last-league";

export function getLastLeague() {
  try {
    const slug = localStorage.getItem(STORAGE_KEY);
    if (LEAGUES.some((l) => l.slug === slug)) return slug;
  } catch {
    // storage unavailable
  }
  return DEFAULT_LEAGUE;
}

export function rememberLeague(slug) {
  try {
    localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // storage unavailable: just not remembered
  }
}
