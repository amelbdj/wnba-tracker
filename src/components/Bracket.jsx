import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPostseasonGames, getSeasonWindows, getStandings, getTournamentGames } from "../services/api";
import { getStat as stat } from "../utils/stats";

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

function SeedSlot({ league, entry, seed }) {
  const { t } = useTranslation();

  if (!entry) {
    return (
      <div className="bracket-slot bracket-slot-tbd">
        <span className="bracket-seed">–</span>
        <span className="bracket-tbd-label">{t("playoffs.tbd")}</span>
      </div>
    );
  }

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

      <div className="bracket-rounds">
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
      </div>
    </div>
  );
}

// ---- Live bracket (real playoff games, once ESPN publishes them) ---------
// ESPN's round headlines aren't formatted the same way across leagues:
// WNBA appends a trailing game number ("First Round - Game 1"), while NCAA
// buries the round name after a regional/city segment ("... Championship -
// Regional 2 in Sacramento - First Four"). Stripping any trailing game
// number and then keeping only the last " - "-separated segment handles
// both shapes with one rule.
function extractRoundLabel(headline) {
  if (!headline) return "Playoffs";
  const withoutGameNumber = headline.replace(/\s*-\s*game\s*\d+\s*$/i, "").trim();
  const segments = withoutGameNumber.split(" - ").map((s) => s.trim());
  return segments[segments.length - 1] || withoutGameNumber;
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

// Groups postseason events into rounds, keeping only the latest game of
// each team-pair series so every matchup shows the current series state.
function buildLiveRounds(events) {
  // Keyed by a lowercased label since ESPN isn't consistent about casing
  // for the same round (e.g. "WNBA Finals" vs "WNBA FINALS" across games).
  const roundMap = new Map();

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const roundLabel = extractRoundLabel(comp.notes?.[0]?.headline);
    const roundKey = roundLabel.toLowerCase();
    const seriesKey = [...(comp.competitors || [])]
      .map((c) => c.team?.id)
      .sort()
      .join("-");

    if (!roundMap.has(roundKey)) roundMap.set(roundKey, { label: roundLabel, seriesMap: new Map() });
    const { seriesMap } = roundMap.get(roundKey);
    const existing = seriesMap.get(seriesKey);
    if (!existing || new Date(event.date) > new Date(existing.date)) {
      seriesMap.set(seriesKey, event);
    }
  }

  return [...roundMap.values()]
    .map(({ label, seriesMap }) => {
      const matchups = [...seriesMap.values()];
      const earliest = Math.min(...matchups.map((e) => new Date(e.date).getTime()));
      return { label, matchups, earliest };
    })
    .sort((a, b) => a.earliest - b.earliest);
}

function LiveSlot({ league, competitor, seriesInfo }) {
  const team = competitor.team;
  return (
    <Link
      to={`/${league}/teams/${team.id}`}
      className={`bracket-slot${competitor.winner ? " bracket-slot-winner" : ""}`}
    >
      <img src={team.logo} alt="" />
      <span className="bracket-team-name">{team.shortDisplayName || team.displayName}</span>
      <span className="bracket-live-score">{seriesInfo?.wins ?? competitor.score ?? "–"}</span>
    </Link>
  );
}

function LiveMatchup({ league, event }) {
  const comp = event.competitions[0];
  const series = comp.series;

  return (
    <div className="bracket-matchup bracket-matchup-live">
      {comp.competitors.map((c) => (
        <LiveSlot
          key={c.team.id}
          league={league}
          competitor={c}
          seriesInfo={series?.competitors?.find((s) => s.id === c.team.id)}
        />
      ))}
      {series?.summary && <div className="bracket-series-summary">{series.summary}</div>}
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

      <div className="bracket-rounds">
        {rounds.map((round) => (
          <div className="bracket-round" key={round.label}>
            <div className="bracket-round-title">{localizeRoundLabel(round.label, t)}</div>
            <div className="bracket-round-matchups">
              {round.matchups.map((event) => (
                <LiveMatchup key={event.id} league={league} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
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
          const label = extractRoundLabel(e.competitions?.[0]?.notes?.[0]?.headline);
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
