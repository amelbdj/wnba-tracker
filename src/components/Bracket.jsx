import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getGamesByDate,
  getPostseasonGames,
  getSeasonWindows,
  getStandings,
  getTournamentGames,
} from "../services/api";
import { getStat as stat } from "../utils/stats";
import { toLocale } from "../utils/locale";
import { formatDateParam, getPollInterval } from "../utils/games";
import {
  buildLiveRounds,
  isBracketEvent,
  isChampionshipDecided,
  localizeRoundLabel,
  trailingWindow,
} from "../utils/bracket";
import { getLeague } from "../leagues";

// Draws the connector lines between rounds (which matchup feeds into which)
// by measuring the actual rendered position of every `.bracket-matchup`
// inside `children` and drawing an SVG bracket-shape line between each pair
// of matchups and the single one they feed into next round. Pure DOM
// measurement rather than CSS math because card heights vary (a live
// matchup with a footer line is taller than a TBD placeholder), so
// there's no fixed spacing to calculate the lines from.
function BracketRoundsShell({ children }) {
  const containerRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function recompute() {
      const containerRect = container.getBoundingClientRect();
      const roundEls = Array.from(container.querySelectorAll(".bracket-round"));
      const roundBoxes = roundEls.map((roundEl) =>
        Array.from(roundEl.querySelectorAll(".bracket-matchup")).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top - containerRect.top + container.scrollTop,
            bottom: r.bottom - containerRect.top + container.scrollTop,
            left: r.left - containerRect.left + container.scrollLeft,
            right: r.right - containerRect.left + container.scrollLeft,
          };
        }),
      );

      const nextPaths = [];
      for (let i = 0; i < roundBoxes.length - 1; i++) {
        const current = roundBoxes[i];
        const next = roundBoxes[i + 1];
        // Only draw connectors where every next-round matchup is fed by
        // exactly two matchups in this round — a plain 2:1 elimination
        // step. Rounds that don't halve cleanly (e.g. NCAA's First Four
        // feeding just 4 of the Round of 64's 32 slots) are left unconnected
        // rather than drawing a misleading line.
        if (current.length !== next.length * 2) continue;

        for (let k = 0; k < next.length; k++) {
          const a = current[2 * k];
          const b = current[2 * k + 1];
          const target = next[k];
          const midX = a.right + (target.left - a.right) / 2;
          const aY = (a.top + a.bottom) / 2;
          const bY = (b.top + b.bottom) / 2;
          const targetY = (target.top + target.bottom) / 2;

          nextPaths.push(
            `M ${a.right} ${aY} H ${midX} M ${b.right} ${bY} H ${midX} M ${midX} ${aY} V ${bY} M ${midX} ${targetY} H ${target.left}`,
          );
        }
      }

      setPaths(nextPaths);
      setSize({ width: container.scrollWidth, height: container.scrollHeight });
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="bracket-rounds" ref={containerRef}>
      <svg className="bracket-connectors" width={size.width} height={size.height}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
      {children}
    </div>
  );
}

// ---- Projected bracket (used until real playoff games exist) --------------
// ESPN doesn't expose real bracket data until the postseason actually
// starts, so until then the bracket is derived live from current standings:
// top 8 records league-wide, seeded 1-8, paired the way the WNBA seeds its
// playoff field (1v8, 4v5, 2v7, 3v6).
function winPct(entry) {
  const wins = stat(entry, "wins")?.value ?? 0;
  const losses = stat(entry, "losses")?.value ?? 0;
  const pctStat = stat(entry, "winPercent");
  if (pctStat?.value != null) return pctStat.value;
  return wins + losses > 0 ? wins / (wins + losses) : 0;
}

function TbdSlot() {
  const { t } = useTranslation();
  return (
    <div className="bracket-slot bracket-slot-tbd">
      <span className="bracket-tbd-mark"></span>
      <span className="bracket-tbd-label">{t("playoffs.tbd")}</span>
    </div>
  );
}

function SeedSlot({ league, entry, seed }) {
  if (!entry) return <TbdSlot />;

  return (
    <Link to={`/${league}/teams/${entry.team?.id}`} className="bracket-slot">
      <span className="bracket-seed">{seed}</span>
      <img src={entry.team?.logos?.[0]?.href} alt="" />
      <span className="bracket-team-name">
        {entry.team?.shortDisplayName || entry.team?.displayName}
      </span>
    </Link>
  );
}

function SeedMatchup({ league, top, topSeed, bottom, bottomSeed }) {
  return (
    <div className="bracket-matchup">
      <SeedSlot league={league} entry={top} seed={topSeed} />
      <SeedSlot league={league} entry={bottom} seed={bottomSeed} />
    </div>
  );
}

function ProjectedBracket({ league, seeds }) {
  const { t } = useTranslation();

  if (seeds.length < 8) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-trophy"></i>
        <strong>{t("playoffs.unavailable")}</strong>
        <span>{t("common.retryLater")}</span>
      </div>
    );
  }

  const [s1, s2, s3, s4, s5, s6, s7, s8] = seeds;

  return (
    <div className="bracket">
      <p className="bracket-note">
        <i className="fa-solid fa-circle-info"></i> {t("playoffs.seedingNote")}
      </p>

      <BracketRoundsShell>
        <div className="bracket-round">
          <div className="bracket-round-title">{t("playoffs.round1")}</div>
          <div className="bracket-round-matchups">
            <SeedMatchup league={league} top={s1} topSeed={1} bottom={s8} bottomSeed={8} />
            <SeedMatchup league={league} top={s4} topSeed={4} bottom={s5} bottomSeed={5} />
            <SeedMatchup league={league} top={s2} topSeed={2} bottom={s7} bottomSeed={7} />
            <SeedMatchup league={league} top={s3} topSeed={3} bottom={s6} bottomSeed={6} />
          </div>
        </div>

        <div className="bracket-round">
          <div className="bracket-round-title">{t("playoffs.semis")}</div>
          <div className="bracket-round-matchups">
            <SeedMatchup league={league} />
            <SeedMatchup league={league} />
          </div>
        </div>

        <div className="bracket-round">
          <div className="bracket-round-title">{t("playoffs.final")}</div>
          <div className="bracket-round-matchups">
            <SeedMatchup league={league} />
          </div>
        </div>
      </BracketRoundsShell>
    </div>
  );
}

// ---- Live bracket (real playoff games, once ESPN publishes them) ---------
function LiveSlot({ league, team, matchup }) {
  if (team.isTbd) return <TbdSlot />;

  const isWinner = matchup.winnerId === team.id;
  const isLoser = matchup.winnerId != null && !isWinner;
  const value = matchup.started ? (matchup.hasSeries ? team.wins : team.score) : null;

  return (
    <Link
      to={`/${league}/teams/${team.id}`}
      className={`bracket-slot${isWinner ? " is-winner" : ""}${isLoser ? " is-loser" : ""}`}
    >
      {team.logo ? <img src={team.logo} alt="" /> : <span className="bracket-tbd-mark"></span>}
      <span className="bracket-team-name">{team.name}</span>
      {value != null && <span className="bracket-score">{value}</span>}
    </Link>
  );
}

function footerText(matchup, t, lang) {
  const formatDate = (ms) =>
    new Date(ms).toLocaleDateString(toLocale(lang), { day: "numeric", month: "short" });

  if (matchup.hasSeries) {
    const [a, b] = matchup.teams;
    if (matchup.winnerId) {
      const winner = a.id === matchup.winnerId ? a : b;
      const loser = winner === a ? b : a;
      return t("playoffs.seriesWins", { team: winner.abbreviation, a: winner.wins, b: loser.wins });
    }
    if (!matchup.started) return t("playoffs.seriesStarts", { date: formatDate(matchup.firstDate) });
    if (a.wins === b.wins) return t("playoffs.seriesTied", { a: a.wins, b: b.wins });
    const lead = a.wins > b.wins ? a : b;
    const trail = lead === a ? b : a;
    return t("playoffs.seriesLeads", { team: lead.abbreviation, a: lead.wins, b: trail.wins });
  }

  return matchup.started ? null : t("playoffs.gameOn", { date: formatDate(matchup.firstDate) });
}

function LiveMatchup({ league, matchup }) {
  const { t, i18n } = useTranslation();
  const text = footerText(matchup, t, i18n.language);

  return (
    <div className={`bracket-matchup${matchup.isLive ? " bracket-matchup-live" : ""}`}>
      {matchup.teams.map((team) => (
        <LiveSlot key={team.id} league={league} team={team} matchup={matchup} />
      ))}
      {(text || matchup.isLive) && (
        <div className="bracket-footer">
          {matchup.isLive && (
            <div className="bracket-live-line">
              <span className="bracket-live-badge">{t("game.live")}</span>
              {/* The card's chips show series wins, so the game in progress gets its own score line. */}
              <span className="bracket-live-score">
                {matchup.teams.map((team) => `${team.abbreviation} ${team.score ?? 0}`).join(" – ")}
              </span>
            </div>
          )}
          {text && <span>{text}</span>}
        </div>
      )}
    </div>
  );
}

function LiveBracket({ league, rounds, completed }) {
  const { t } = useTranslation();

  return (
    <div className="bracket">
      <p className={`bracket-note${completed ? "" : " bracket-note-live"}`}>
        {completed ? (
          <i className="fa-solid fa-trophy"></i>
        ) : (
          <span className="bracket-live-dot"></span>
        )}{" "}
        {t(completed ? "playoffs.completedNote" : "playoffs.liveNote")}
      </p>

      <BracketRoundsShell>
        {rounds.map((round) => (
          <div className="bracket-round" key={round.label}>
            <div className="bracket-round-title">{localizeRoundLabel(round.label, t)}</div>
            <div className="bracket-round-matchups">
              {round.matchups.map((matchup) => (
                <LiveMatchup key={matchup.key} league={league} matchup={matchup} />
              ))}
            </div>
          </div>
        ))}
      </BracketRoundsShell>
    </div>
  );
}

function NotStartedBracket() {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <i className="fa-solid fa-trophy"></i>
      <strong>{t("playoffs.notStartedTitle")}</strong>
      <span>{t("playoffs.notStartedSubtitle")}</span>
    </div>
  );
}

// ---- Entry point -----------------------------------------------------------
// A league's bracket moves through three states, detected automatically
// with no manual switch:
//  - "projected": no real playoff games yet — seeded from current standings.
//  - "live": the current season's real playoff games are underway.
//  - "completed": the most recently finished season's real bracket, kept on
//    screen until the next season's games actually start being recorded (at
//    which point ESPN's own standings flip over and this naturally resets
//    to "projected" for the new season).
export default function Bracket({ league }) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("projected");
  // Raw ESPN events behind the live/completed bracket. Kept (instead of only
  // the derived rounds) so a background refresh can merge fresh scores in.
  const [events, setEvents] = useState(null);
  const [eventSource, setEventSource] = useState("postseason"); // | "tournament"
  const [seeds, setSeeds] = useState([]);
  const [retryTick, setRetryTick] = useState(0);
  const rounds = useMemo(() => (events ? buildLiveRounds(events) : null), [events]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    async function load() {
      const windows = await getSeasonWindows(league);

      if (windows?.postseason) {
        // Leagues with a clean regular-season/postseason split (WNBA, NCAA).
        const postseasonGames = await getPostseasonGames(league, windows.postseason);
        if (postseasonGames.length > 0) {
          const isComplete =
            new Date() > new Date(windows.postseason.endDate) || isChampionshipDecided(postseasonGames);
          if (!cancelled) {
            setMode(isComplete ? "completed" : "live");
            setEventSource("postseason");
            setEvents(postseasonGames);
            setLoading(false);
          }
          return;
        }
      } else if (windows?.regular) {
        // Competitions with no postseason split at all (FIBA World Cup,
        // Olympics, NCAA volleyball) — every game shares one season type, so
        // the knockout bracket is whichever games carry a knockout headline.
        const bracketConfig = getLeague(league).bracket;
        const scanWindow = trailingWindow(windows.regular, bracketConfig?.scanLastDays);
        const allGames = await getTournamentGames(league, scanWindow);
        const knockoutGames = allGames.filter((e) => isBracketEvent(e, bracketConfig));
        if (knockoutGames.length > 0) {
          const isComplete =
            new Date() > new Date(windows.regular.endDate) || isChampionshipDecided(knockoutGames);
          if (!cancelled) {
            setMode(isComplete ? "completed" : "live");
            setEventSource("tournament");
            setEvents(knockoutGames);
            setLoading(false);
          }
          return;
        }
      }

      // Nothing to show yet. An 8-team playoff can be projected from the
      // standings; a 64-team single-elimination field (NCAA volleyball)
      // can't, so there we just say the tournament hasn't started.
      if (getLeague(league).bracket?.projected === false) {
        if (!cancelled) {
          setMode("notStarted");
          setEvents(null);
          setLoading(false);
        }
        return;
      }

      const groups = await getStandings(league);
      const all = groups.flatMap((g) => g.entries);
      const sorted = [...all].sort((a, b) => winPct(b) - winPct(a));
      if (!cancelled) {
        setMode("projected");
        setEvents(null);
        setSeeds(sorted.slice(0, 8));
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [league]);

  // Live scores: while a playoff game is in progress (or about to start),
  // re-fetch just today's and yesterday's scoreboards — not the whole
  // postseason window — and merge them into the events already loaded.
  useEffect(() => {
    if (mode !== "live" || !events) return;
    const delay = getPollInterval(events);
    if (delay == null) return;

    let cancelled = false;
    const id = setTimeout(async () => {
      if (!document.hidden) {
        try {
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const days = await Promise.all([
            getGamesByDate(league, formatDateParam(now)),
            getGamesByDate(league, formatDateParam(yesterday)),
          ]);
          const bracketConfig = getLeague(league).bracket;
          const keep = (e) =>
            eventSource === "postseason" ? e.season?.type === 3 : isBracketEvent(e, bracketConfig);

          const byId = new Map(events.map((e) => [e.id, e]));
          for (const e of days.flat().filter((x) => x && keep(x))) byId.set(e.id, e);
          if (!cancelled) setEvents([...byId.values()]);
          return;
        } catch {
          // Keep showing the last known scores; try again next cycle.
        }
      }
      if (!cancelled) setRetryTick((n) => n + 1);
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [mode, events, eventSource, league, retryTick]);

  if (loading) {
    return (
      <div className="bracket">
        <div className="skeleton skeleton-card"></div>
      </div>
    );
  }

  if (mode === "notStarted") {
    return <NotStartedBracket />;
  }

  if (mode === "live" || mode === "completed") {
    return <LiveBracket league={league} rounds={rounds} completed={mode === "completed"} />;
  }

  return <ProjectedBracket league={league} seeds={seeds} />;
}
