import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTeamSchedule } from "../services/api";
import { getLeague } from "../leagues";
import { useFavorites } from "../utils/favorites";
import { getPollInterval } from "../utils/games";
import { toMatch } from "../utils/teamMatches";
import { toLocale } from "../utils/locale";
import FavoriteButton from "./FavoriteButton";
import GameDetails from "./GameDetails";
import TeamLink from "./TeamLink";

const keyOf = (f) => `${f.league}:${f.id}`;

// A team's schedule boiled down to what the card shows: the match in
// progress or, failing that, the last result — plus the next match.
function pickMatches(events, teamId, t) {
  const matches = (events || []).map((e) => toMatch(e, teamId, t)).filter(Boolean);
  const live = matches.find((m) => m.state === "live");
  const played = matches.filter((m) => m.state === "final");
  const next = matches.find((m) => m.state === "upcoming");
  return { primary: live || played[played.length - 1] || null, next: next || null };
}

function MatchLine({ label, match, league, onOpen, locale }) {
  const day = new Date(match.date).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const time = new Date(match.date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const scored = match.state === "final" || match.state === "live";

  return (
    <div
      className={`fav-match${match.state === "live" ? " is-live" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen({ league, id: match.id })}
      onKeyDown={(e) => e.key === "Enter" && onOpen({ league, id: match.id })}
    >
      <span className="fav-match-label">
        {match.state === "live" && <span className="dot"></span>}
        {label}
      </span>
      <span className="fav-match-vs">
        {match.home ? "vs" : "@"} {match.opponent.shortDisplayName || match.opponent.displayName}
      </span>
      <span className="fav-match-result">
        {scored ? (
          <>
            {match.state === "final" && (
              <span className={`games-log-result ${match.won ? "win" : "loss"}`}>{match.won ? "W" : "L"}</span>
            )}
            {match.score[0]}-{match.score[1]}
          </>
        ) : (
          <span className="fav-match-when">
            {day} · {time}
          </span>
        )}
      </span>
    </div>
  );
}

// "My teams" on the home page: every favourite across all leagues, each with
// its live match or latest result and its next match. Renders nothing until a
// team has been starred. Refreshes itself while any of them is playing or
// about to.
export default function FavoriteTeams() {
  const { t, i18n } = useTranslation();
  const { favorites } = useFavorites();
  const [schedules, setSchedules] = useState({}); // "league:id" -> events
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(null);
  const locale = toLocale(i18n.language);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      favorites.map((f) =>
        getTeamSchedule(f.league, f.id).then(
          (events) => [keyOf(f), events],
          () => null, // keep what we had for this team
        ),
      ),
    ).then((entries) => {
      if (!cancelled) setSchedules((prev) => ({ ...prev, ...Object.fromEntries(entries.filter(Boolean)) }));
    });
    return () => {
      cancelled = true;
    };
  }, [favorites, tick]);

  // Poll only while something is live or about to start (same rule as the
  // games list), and pick up again when the tab comes back to the foreground.
  useEffect(() => {
    const games = favorites.flatMap((f) => {
      const { primary, next } = pickMatches(schedules[keyOf(f)], f.id, t);
      return [primary, next].filter(Boolean).map((m) => ({ status: m.status, date: m.date }));
    });
    const interval = getPollInterval(games);
    const onVisible = () => {
      if (!document.hidden) setTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = interval
      ? setTimeout(() => {
          if (!document.hidden) setTick((n) => n + 1);
        }, interval)
      : null;
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [favorites, schedules, t, tick]);

  if (favorites.length === 0) return null;

  return (
    <div className="section fav-section">
      <div className="section-head">
        <div>
          <span className="section-eyebrow">
            <i className="fa-solid fa-star"></i> {t("favorites.title")}
          </span>
        </div>
      </div>

      <div className="fav-grid">
        {favorites.map((f) => {
          const events = schedules[keyOf(f)];
          const { primary, next } = events ? pickMatches(events, f.id, t) : {};
          return (
            <div key={keyOf(f)} className="fav-card">
              <div className="fav-card-head">
                <TeamLink league={f.league} teamId={f.id} className="fav-card-team">
                  {f.logo && <img src={f.logo} alt="" />}
                  <span className="fav-card-text">
                    <span className="fav-card-name">{f.name}</span>
                    <span className="fav-card-league">{getLeague(f.league).shortLabel}</span>
                  </span>
                </TeamLink>
                <FavoriteButton league={f.league} team={{ id: f.id, displayName: f.name }} />
              </div>

              {!events ? (
                <div className="skeleton" style={{ height: 70, borderRadius: 12 }}></div>
              ) : primary || next ? (
                <>
                  {primary && (
                    <MatchLine
                      label={t(primary.state === "live" ? "favorites.live" : "favorites.last")}
                      match={primary}
                      league={f.league}
                      onOpen={setOpen}
                      locale={locale}
                    />
                  )}
                  {next && (
                    <MatchLine
                      label={t("favorites.next")}
                      match={next}
                      league={f.league}
                      onOpen={setOpen}
                      locale={locale}
                    />
                  )}
                </>
              ) : (
                <p className="vb-note">{t("favorites.noMatch")}</p>
              )}
            </div>
          );
        })}
      </div>

      {open && <GameDetails gameId={open.id} league={open.league} onClose={() => setOpen(null)} />}
    </div>
  );
}
