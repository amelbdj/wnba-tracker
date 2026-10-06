import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPostseasonGames, getSeasonWindows, getStandings, getTournamentGames } from "../services/api";
import { getStat as stat } from "../utils/stats";
import { toLocale } from "../utils/locale";

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
// ESPN's round headlines aren't formatted consistently — not across
// leagues, and not even within one league's postseason:
//   WNBA:  "First Round - Game 1", "Semifinals - Game 1", then
//          "WNBA Semifinals - Game 4 If Necessary", "WNBA Finals - Game 1"
//   NCAA:  "NCAA Women's Basketball Championship - Regional 2 in
//          Sacramento - First Four"
// So: drop everything from "- Game N" onward (including "If Necessary"),
// keep only the last " - "-separated segment, and drop a leading league
// name so "Semifinals" and "WNBA Semifinals" land in the same round.
function normalizeRoundLabel(headline) {
  if (!headline) return "Playoffs";
  const withoutGame = headline.replace(/\s*-\s*game\s*\d+.*$/i, "").trim();
  const segments = withoutGame.split(" - ").map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1] || withoutGame;
  return last.replace(/^(wnba|nba|ncaa|fiba)\s+/i, "") || last;
}

function localizeRoundLabel(label, t) {
  const lower = label.toLowerCase();
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

function isGroupStageLabel(label) {
  return /^(group|pool)\b/i.test(label);
}

// Collapses every game between the same two teams in a round (a best-of-N
// series, or just one game in a single-elimination tournament) into ONE
// matchup, so the bracket shows the series — not each game — and its state
// comes from the most recent game actually played.
function buildMatchup(key, events) {
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
function reorderRoundsByLineage(rounds) {
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

function buildLiveRounds(events) {
  // Keyed by a lowercased label since ESPN isn't consistent about casing
  // for the same round (e.g. "WNBA Finals" vs "WNBA FINALS" across games).
  const roundMap = new Map();

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp?.competitors?.length) continue;
    const label = normalizeRoundLabel(comp.notes?.[0]?.headline);
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
          {matchup.isLive && <span className="bracket-live-badge">{t("game.live")}</span>}
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
  const [rounds, setRounds] = useState(null);
  const [seeds, setSeeds] = useState([]);

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
          const isComplete = new Date() > new Date(windows.postseason.endDate);
          if (!cancelled) {
            setMode(isComplete ? "completed" : "live");
            setRounds(buildLiveRounds(postseasonGames));
            setLoading(false);
          }
          return;
        }
      } else if (windows?.regular) {
        // Short tournaments with no postseason split at all (FIBA World Cup,
        // Olympics) — group stage and knockout games share one season type,
        // so the knockout bracket is whatever isn't labeled a group game.
        const allGames = await getTournamentGames(league, windows.regular);
        const knockoutGames = allGames.filter((e) => {
          const label = normalizeRoundLabel(e.competitions?.[0]?.notes?.[0]?.headline);
          return !isGroupStageLabel(label);
        });
        if (knockoutGames.length > 0) {
          const isComplete = new Date() > new Date(windows.regular.endDate);
          if (!cancelled) {
            setMode(isComplete ? "completed" : "live");
            setRounds(buildLiveRounds(knockoutGames));
            setLoading(false);
          }
          return;
        }
      }

      const groups = await getStandings(league);
      const all = groups.flatMap((g) => g.entries);
      const sorted = [...all].sort((a, b) => winPct(b) - winPct(a));
      if (!cancelled) {
        setMode("projected");
        setSeeds(sorted.slice(0, 8));
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [league]);

  if (loading) {
    return (
      <div className="bracket">
        <div className="skeleton skeleton-card"></div>
      </div>
    );
  }

  if (mode === "live" || mode === "completed") {
    return <LiveBracket league={league} rounds={rounds} completed={mode === "completed"} />;
  }

  return <ProjectedBracket league={league} seeds={seeds} />;
}
