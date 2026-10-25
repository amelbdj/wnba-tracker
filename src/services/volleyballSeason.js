import { useEffect, useSyncExternalStore } from "react";
import { getTeamSchedule, getVolleyballBoxscore } from "./api";

// A volleyball team's season, rebuilt from NCAA.com box scores: NCAA has no
// rosters or player pages, so the squad and every player's stats come from
// reading the team's finished matches one by one.
//
// That is dozens of requests, so it is loaded *progressively*, newest match
// first, and published after each match — a page can show what it has and
// fill in the rest instead of waiting for the whole season. The store lives
// outside React and outlasts pages: the squad on a team page and a player's
// page share the same matches, and anything already read isn't fetched twice.

const WORKERS = 4; // matches read at once (NCAA.com's wrapper rate-limits bursts)

const INITIAL = { matches: [], loaded: 0, fetched: 0, total: null, done: false, error: false };
const entries = new Map();

const scoreOf = (c) => Number(c.score?.displayValue ?? c.score) || 0;

function entryFor(league, teamId) {
  const key = `${league}:${teamId}`;
  if (!entries.has(key)) {
    const listeners = new Set();
    entries.set(key, {
      state: INITIAL,
      target: 0, // how many matches (newest first) callers want so far
      queue: null, // the team's finished matches, newest first
      next: 0, // index of the next queued match to fetch
      finished: new Set(), // indexes of queued matches already read
      pumping: false,
      listeners,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
  }
  return entries.get(key);
}

function publish(entry, patch) {
  entry.state = { ...entry.state, ...patch };
  entry.listeners.forEach((listener) => listener());
}

// One finished ESPN match as this team's row: opponent, score and the team's
// per-player lines — or null when NCAA.com has no box score for it.
async function readMatch(competition, teamId) {
  const side = competition.competitors.findIndex((c) => String(c.team.id) === String(teamId));
  const box = await getVolleyballBoxscore(competition);
  if (!box || side < 0) return null;

  const us = competition.competitors[side];
  const them = competition.competitors[1 - side];
  return {
    id: competition.id,
    date: competition.date,
    opponent: {
      id: them.team.id,
      displayName: them.team.displayName,
      abbreviation: them.team.abbreviation,
      logo: them.team.logos?.[0]?.href || them.team.logo,
    },
    home: us.homeAway === "home",
    score: [scoreOf(us), scoreOf(them)],
    won: scoreOf(us) > scoreOf(them),
    players: box.teams[side].players,
  };
}

async function pump(entry, league, teamId) {
  entry.pumping = true;
  try {
    if (!entry.queue) {
      const events = await getTeamSchedule(league, teamId);
      entry.queue = events
        .map((e) => e.competitions?.[0])
        .filter((c) => c?.status?.type?.completed && c.competitors?.length === 2)
        .reverse();
      entry.next = 0;
      entry.finished = new Set();
      publish(entry, {
        matches: [], // (also clears a previous failed attempt)
        loaded: 0,
        fetched: 0,
        total: entry.queue.length,
        done: entry.queue.length === 0,
      });
    }

    // A small pool of workers, each taking the next match as soon as it is
    // free, so one slow request doesn't hold the others back. Every match is
    // published the moment it is read. `target` can grow while this runs (a
    // page asks for the whole season after the squad is shown), so it is
    // re-read each time a worker looks for work, and the pool is restarted
    // if work remains when it empties.
    const wanted = () => Math.min(entry.target, entry.queue.length);
    const worker = async () => {
      while (entry.next < wanted()) {
        const index = entry.next++;
        let match = null;
        try {
          match = await readMatch(entry.queue[index], teamId);
        } catch {
          // no box score for this one — leave it out
        }
        entry.finished.add(index);

        // `loaded` is how many of the newest matches are *all* read (the
        // squad needs the newest ones, not just any); `fetched` counts them
        // in whatever order they came back.
        let prefix = 0;
        while (entry.finished.has(prefix)) prefix += 1;
        publish(entry, {
          matches: match
            ? [...entry.state.matches, match].sort((a, b) => new Date(b.date) - new Date(a.date))
            : entry.state.matches,
          loaded: prefix,
          fetched: entry.finished.size,
          done: entry.finished.size >= entry.queue.length,
        });
      }
    };
    while (entry.next < wanted()) {
      await Promise.all(Array.from({ length: WORKERS }, worker));
    }
  } catch {
    entry.queue = null; // start over from the schedule next time
    publish(entry, { error: true });
  } finally {
    entry.pumping = false;
  }
}

// Ask for a team's newest `limit` finished matches (default: all of them).
// Safe to call repeatedly; only what is missing gets fetched.
export function requestSeason(league, teamId, limit = Infinity) {
  const entry = entryFor(league, teamId);
  entry.target = Math.max(entry.target, limit);
  if (entry.pumping) return;
  if (entry.state.error) publish(entry, { error: false });
  pump(entry, league, teamId);
}

// A team's season so far: { matches (newest first), loaded, fetched, total,
// done, error, settled }, where `settled` means the `limit` newest matches
// have all been read (or there are no more). Re-renders as matches arrive.
export function useTeamSeason(league, teamId, limit = Infinity) {
  const entry = entryFor(league, teamId);
  const state = useSyncExternalStore(entry.subscribe, () => entry.state);

  useEffect(() => {
    requestSeason(league, teamId, limit);
  }, [league, teamId, limit]);

  const settled = state.total != null && state.loaded >= Math.min(limit, state.total);
  return { ...state, settled };
}
