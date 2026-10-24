// Matching for the quick search. Names are compared lowercased, without
// accents or punctuation, so "hawai'i", "Hawaiʻi" and "hawaii" are the same.
export function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘ʻ`]/g, "") // "Hawai'i" -> "hawaii", "St. John's" -> "st johns"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// How well `query` (already normalised) matches one of `names`, 0 = not at all.
// Whole name > start of the name > start of any word > anywhere; a query of
// several words matches when each one starts a word of the name.
export function matchScore(names, query) {
  if (!query) return 0;
  const tokens = query.split(" ");
  let best = 0;

  for (const raw of names) {
    const name = normalize(raw);
    if (!name) continue;

    let score = 0;
    if (name === query) score = 100;
    else if (name.startsWith(query)) score = 80;
    else {
      const words = name.split(" ");
      if (words.some((w) => w.startsWith(query))) score = 60;
      else if (tokens.length > 1 && tokens.every((t) => words.some((w) => w.startsWith(t)))) score = 55;
      else if (name.includes(query)) score = 40;
    }
    best = Math.max(best, score);
  }
  return best;
}

// The best `limit` of `items` for `query`, best first (ties keep their order).
export function rankBy(items, query, namesOf, limit) {
  return items
    .map((item) => ({ item, score: matchScore(namesOf(item), query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item);
}

// ---- Recently opened results (this browser only) ---------------------------
const RECENT_KEY = "frontrow:recent-search";
const RECENT_MAX = 6;

export function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(parsed) ? parsed.filter((r) => r?.key && r?.to) : [];
  } catch {
    return [];
  }
}

// Remembers a result the user opened, most recent first, without duplicates.
export function rememberResult(result) {
  const { key, kind, name, sub, image, to } = result;
  const next = [{ key, kind, name, sub, image, to }, ...readRecent().filter((r) => r.key !== key)].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recents just don't persist
  }
}
