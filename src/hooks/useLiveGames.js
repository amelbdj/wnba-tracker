import { useCallback, useEffect, useRef, useState } from "react";
import { getGamesByDate } from "../services/api";
import { formatDateParam, getPollInterval } from "../utils/games";

// Loads a league's games for a given day and keeps them fresh by itself: a
// silent background refetch (no loading skeleton, no flicker) runs while a
// game is in progress or about to start, at the cadence from
// getPollInterval(), so scores and the game clock update with no page
// refresh. ESPN's public API has no push channel, so polling it is.
//
// - Pauses while the tab is hidden and refreshes right away when it comes
//   back, instead of hammering the API from a background tab.
// - A failed refresh keeps showing the last known scores and just tries
//   again next cycle.
// - A response that lands after the league/day changed is ignored.
export function useLiveGames(league, date) {
  const dateParam = formatDateParam(date);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const currentKey = useRef("");
  const gamesRef = useRef(games);

  useEffect(() => {
    gamesRef.current = games;
  });

  // Initial load, and again whenever the league or day changes.
  useEffect(() => {
    currentKey.current = `${league}:${dateParam}`;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    getGamesByDate(league, dateParam)
      .then((data) => {
        if (!cancelled) setGames(data || []);
      })
      .catch(() => {
        if (!cancelled) setGames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [league, dateParam]);

  const refresh = useCallback(async () => {
    const key = `${league}:${dateParam}`;
    try {
      const data = await getGamesByDate(league, dateParam);
      if (currentKey.current === key) setGames(data || []);
    } catch {
      if (currentKey.current === key) setRetryTick((n) => n + 1);
    }
  }, [league, dateParam]);

  // Schedules the next refresh. Every successful refresh replaces `games`,
  // which re-runs this effect and re-evaluates the cadence (e.g. a game that
  // just went final stops the polling on its own).
  useEffect(() => {
    if (loading) return;
    const delay = getPollInterval(games);
    if (delay == null) return;

    const id = setTimeout(() => {
      if (document.hidden) setRetryTick((n) => n + 1);
      else refresh();
    }, delay);
    return () => clearTimeout(id);
  }, [games, loading, retryTick, refresh]);

  useEffect(() => {
    function onVisible() {
      if (!document.hidden && getPollInterval(gamesRef.current) != null) refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const hasLive = games.some((g) => g.status?.type?.state === "in");
  return { games, loading, hasLive };
}
