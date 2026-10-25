// The pure logic behind the playoff bracket: turning ESPN's postseason games
// (inconsistent headlines, series spread over several games, no bracket order)
// into rounds of matchups. Kept apart from the React components so it can be
// tested on its own.

// ESPN's round headlines aren't formatted consistently — not across
// leagues, and not even within one league's postseason:
//   WNBA:  "First Round - Game 1", "Semifinals - Game 1", then
//          "WNBA Semifinals - Game 4 If Necessary", "WNBA Finals - Game 1"
//   NCAA:  "NCAA Women's Basketball Championship - Regional 2 in
//          Sacramento - First Four"
// So: drop everything from "- Game N" onward (including "If Necessary"),
// keep only the last " - "-separated segment, and drop a leading league
// name so "Semifinals" and "WNBA Semifinals" land in the same round.
export function normalizeRoundLabel(headline) {
  if (!headline) return "Playoffs";
  const withoutGame = headline.replace(/\s*-\s*game\s*\d+.*$/i, "").trim();
  const segments = withoutGame.split(" - ").map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1] || withoutGame;
  return last.replace(/^(wnba|nba|ncaa|fiba)\s+/i, "") || last;
}

export function localizeRoundLabel(label, t) {
  const lower = label.toLowerCase();
  // NCAA volleyball: each "<City> Regional" holds a semifinal round and a
  // final, relabeled by labelEvents() below.
  if (lower.includes("regional")) {
    return lower.includes("semi") ? t("playoffs.regionalSemis") : t("playoffs.regionalFinal");
  }
  if (/\b(2nd|second) round\b/.test(lower)) return t("playoffs.round2");
  // NCAA's "Final Four" is a semifinal-stage round, not the championship —
  // keep ESPN's own name rather than mislabeling it as the final.
  if (lower.includes("final four")) return label;
  if (
    lower.includes("championship") ||
    (/\bfinals?\b/.test(lower) && !lower.includes("semi") && !lower.includes("quarter"))
  ) {
    return t("playoffs.final");
  }
  if (lower.includes("semi")) return t("playoffs.semis");
  if (lower.includes("first round") || lower.includes("1st round") || lower.includes("quarter")) {
    return t("playoffs.round1");
  }
  return label;
}

export function isGroupStageLabel(label) {
  return /^(group|pool)\b/i.test(label);
}

// A game belongs to the knockout bracket only if ESPN gave it a round
// headline that isn't a group-stage one — and, for leagues whose tournament
// shares headlines with other competitions (NCAA volleyball conference
// tournaments), one that matches the league's own championship.
export function isBracketEvent(event, bracketConfig) {
  const headline = event.competitions?.[0]?.notes?.[0]?.headline;
  if (!headline) return false;
  if (bracketConfig?.headlinePrefix && !bracketConfig.headlinePrefix.test(headline)) return false;
  return !isGroupStageLabel(normalizeRoundLabel(headline));
}

// Round label per event. Almost always straight from the headline, except
// NCAA volleyball's regionals: ESPN names both the regional semifinals and
// the regional final just "<City> Regional". Within a region the games are
// played in order, so the final is the one whose teams already played earlier
// in that region (or, once a region lists all 3 games, simply the last one).
export function labelEvents(events) {
  const labels = new Map();
  const regions = new Map();

  for (const event of events) {
    const label = normalizeRoundLabel(event.competitions?.[0]?.notes?.[0]?.headline);
    if (/\bregional$/i.test(label)) {
      if (!regions.has(label)) regions.set(label, []);
      regions.get(label).push(event);
    } else {
      labels.set(event.id, label);
    }
  }

  for (const regionEvents of regions.values()) {
    const sorted = [...regionEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    const seen = new Set();
    sorted.forEach((event, i) => {
      const ids = event.competitions[0].competitors.map((c) => c.team?.id);
      const allSeen = seen.size > 0 && ids.every((id) => seen.has(id));
      const isFinal = allSeen || (sorted.length >= 3 && i === sorted.length - 1);
      labels.set(event.id, isFinal ? "Regional Final" : "Regional Semifinals");
      ids.forEach((id) => seen.add(id));
    });
  }

  return labels;
}

// Collapses every game between the same two teams in a round (a best-of-N
// series, or just one game in a single-elimination tournament) into ONE
// matchup, so the bracket shows the series — not each game — and its state
// comes from the most recent game actually played.
export function buildMatchup(key, events) {
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first = sorted[0];
  const statusOf = (e) => e.competitions[0].status?.type;

  const completedGames = sorted.filter((e) => statusOf(e)?.completed);
  const liveGame = sorted.find((e) => statusOf(e)?.state === "in");
  // Series wins/summary are a snapshot as of each game, so the latest
  // *completed* game is the one that reflects the current state.
  const state = completedGames.length ? completedGames[completedGames.length - 1] : first;
  const scoreEvent = liveGame || state;
  const series = state.competitions[0].series;
  const started = completedGames.length > 0 || Boolean(liveGame);

  // Team order comes from the first game (home team there = higher seed), so
  // it stays stable instead of flipping with each game's home/away.
  const teams = first.competitions[0].competitors.map((c) => {
    const id = c.team.id;
    const findIn = (event) => event.competitions[0].competitors.find((x) => x.team.id === id);
    const seriesEntry = series?.competitors?.find((s) => s.id === id);
    return {
      id,
      isTbd: Number(id) < 0 || c.team.displayName === "TBD",
      name: c.team.shortDisplayName || c.team.displayName,
      abbreviation: c.team.abbreviation,
      logo: c.team.logo,
      wins: seriesEntry?.wins ?? 0,
      score: findIn(scoreEvent)?.score ?? null,
      wonLastGame: Boolean(findIn(state)?.winner),
    };
  });

  // The winner is the winner of the *series*, not of the latest game — a
  // team that just won game 2 of a best-of-5 hasn't won anything yet.
  let winnerId = null;
  if (series) {
    const done = series.completed || /wins series/i.test(series.summary || "");
    if (done) {
      winnerId = teams.reduce((best, team) => (team.wins > best.wins ? team : best), teams[0]).id;
    }
  } else if (completedGames.length) {
    winnerId = teams.find((team) => team.wonLastGame)?.id ?? null;
  }

  return {
    key,
    teams,
    // Real teams only — "TBD" placeholders (negative ids) have no lineage.
    teamIds: teams.filter((team) => !team.isTbd).map((team) => team.id),
    hasSeries: Boolean(series),
    started,
    isLive: Boolean(liveGame),
    winnerId,
    firstDate: new Date(first.date).getTime(),
  };
}

// ESPN returns postseason games in whatever order the API feels like (mostly
// by date/time), not in bracket left-to-right order — so two matchups that
// happen to sit side by side in a round often have nothing to do with each
// other. This walks backward from the final, and for every matchup places
// its two "parent" matchups (the earlier-round series its two teams actually
// won to get there) next to each other — so array-adjacent matchups really
// do feed the same next-round game, which is what both the reading order
// and the connector lines rely on.
export function reorderRoundsByLineage(rounds) {
  const ordered = rounds.map((round) => ({ ...round }));

  for (let i = ordered.length - 1; i > 0; i--) {
    const parents = ordered[i].matchups;
    const children = ordered[i - 1].matchups;

    const childByTeamId = new Map();
    for (const child of children) {
      for (const id of child.teamIds) childByTeamId.set(id, child);
    }

    const placed = new Set();
    const reordered = [];
    for (const parent of parents) {
      for (const id of parent.teamIds) {
        const child = childByTeamId.get(id);
        if (child && !placed.has(child)) {
          reordered.push(child);
          placed.add(child);
        }
      }
    }
    // Matchups that didn't feed a known team into the next round (e.g.
    // NCAA's First Four only fills some of the Round of 64 slots, or a
    // next round that's still all "TBD") keep their original relative
    // order, appended at the end.
    for (const child of children) {
      if (!placed.has(child)) reordered.push(child);
    }

    ordered[i - 1] = { ...ordered[i - 1], matchups: reordered };
  }

  return ordered;
}

export function buildLiveRounds(events) {
  // Keyed by a lowercased label since ESPN isn't consistent about casing
  // for the same round (e.g. "WNBA Finals" vs "WNBA FINALS" across games).
  const roundMap = new Map();
  const labels = labelEvents(events);

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp?.competitors?.length) continue;
    const label = labels.get(event.id) ?? "Playoffs";
    const roundKey = label.toLowerCase();
    const seriesKey = comp.competitors
      .map((c) => c.team?.id)
      .sort()
      .join("-");

    if (!roundMap.has(roundKey)) roundMap.set(roundKey, { label, seriesMap: new Map() });
    const { seriesMap } = roundMap.get(roundKey);
    if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, []);
    seriesMap.get(seriesKey).push(event);
  }

  const rounds = [...roundMap.values()]
    .map(({ label, seriesMap }) => {
      const matchups = [...seriesMap.entries()].map(([key, evs]) => buildMatchup(key, evs));
      const earliest = Math.min(...matchups.map((m) => m.firstDate));
      return { label, matchups, earliest };
    })
    .sort((a, b) => a.earliest - b.earliest);

  return reorderRoundsByLineage(rounds);
}


// Limits a long window (NCAA volleyball's runs August -> January) to its
// last `days` days, since that's where the knockout games are.
export function trailingWindow(range, days) {
  if (!days) return range;
  const end = new Date(range.endDate).getTime();
  const start = Math.max(new Date(range.startDate).getTime(), end - days * 24 * 60 * 60 * 1000);
  return { startDate: new Date(start).toISOString(), endDate: range.endDate };
}

// The title is decided once the last round is a single matchup with a winner
// (WNBA Finals / the NCAA championship match) — from then on the bracket is
// a finished tournament even though the season window hasn't closed yet.
export function isChampionshipDecided(events) {
  const rounds = buildLiveRounds(events);
  const last = rounds[rounds.length - 1];
  return rounds.length >= 2 && last.matchups.length === 1 && last.matchups[0].winnerId != null;
}
