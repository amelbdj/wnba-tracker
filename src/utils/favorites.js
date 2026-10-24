import { useSyncExternalStore } from "react";

// Favourite teams, kept in this browser only (no account, no server). Each is
// stored with the little it takes to draw it — league, ESPN id, name, logo —
// so the home page can list them before any request has come back.
const STORAGE_KEY = "frontrow:favorites";

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter((f) => f && f.league && f.id != null) : [];
  } catch {
    return []; // storage blocked, empty, or not JSON
  }
}

let current = readStored();
const listeners = new Set();

function publish(next) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / full storage: favourites still work until the tab closes.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  // Another tab changed them.
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      current = readStored();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const sameTeam = (f, league, id) => f.league === league && String(f.id) === String(id);

// `team` is an ESPN team object.
function toFavorite(league, team) {
  return {
    league,
    id: String(team.id),
    name: team.displayName,
    shortName: team.shortDisplayName || team.displayName,
    abbreviation: team.abbreviation || "",
    logo: team.logos?.[0]?.href || team.logo || "",
  };
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, () => current);

  return {
    favorites,
    isFavorite: (league, id) => favorites.some((f) => sameTeam(f, league, id)),
    toggle(league, team) {
      publish(
        favorites.some((f) => sameTeam(f, league, team.id))
          ? favorites.filter((f) => !sameTeam(f, league, team.id))
          : [...favorites, toFavorite(league, team)],
      );
    },
  };
}
