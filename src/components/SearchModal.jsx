import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LEAGUES, getLeague } from "../leagues";
import { getSearchableTeams, getVolleyballSearchPlayers, searchPlayersAcross } from "../services/api";
import { useFavorites } from "../utils/favorites";
import { buildTeamIndex, findTeam } from "../utils/ncaaTeams";
import { normalize, rankBy, readRecent, rememberResult } from "../utils/search";
import { closeSearch } from "../utils/searchStore";
import { playerSlug } from "../utils/volleyballBoxscore";
import Modal from "./Modal";

const MAX_TEAMS = 6;
const MAX_PLAYERS = 8;
const PLAYER_SEARCH_DELAY_MS = 250;

const ALL_LEAGUES = LEAGUES.map((l) => l.slug);
// Leagues ESPN's player search covers (volleyball players come from NCAA.com).
const ESPN_PLAYER_LEAGUES = LEAGUES.filter((l) => l.features?.players !== false).map((l) => l.slug);
const VOLLEYBALL = LEAGUES.find((l) => l.sport === "volleyball")?.slug;

function teamResult(team) {
  return {
    key: `t:${team.league}:${team.id}`,
    kind: "team",
    name: team.displayName,
    sub: getLeague(team.league).shortLabel,
    image: team.logo,
    to: `/${team.league}/teams/${team.id}`,
  };
}

// Quick search: teams of every league, basketball players (ESPN) and the
// volleyball players on the NCAA leaderboards. With nothing typed it offers
// the favourite teams and what was opened last. Arrow keys + Enter, or click.
export default function SearchModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [teams, setTeams] = useState(null); // null while loading
  const [vbPlayers, setVbPlayers] = useState([]);
  const [espnPlayers, setEspnPlayers] = useState({ query: "", results: [] });
  const [recent] = useState(readRecent);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getSearchableTeams(ALL_LEAGUES).then((list) => {
      if (!cancelled) setTeams(list);
    });
    getVolleyballSearchPlayers().then((list) => {
      if (!cancelled) setVbPlayers(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const q = normalize(query);

  // ESPN player search, once the user pauses typing.
  useEffect(() => {
    if (q.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlayersAcross(q, ESPN_PLAYER_LEAGUES)
        .then((results) => {
          if (!cancelled) setEspnPlayers({ query: q, results });
        })
        .catch(() => {
          if (!cancelled) setEspnPlayers({ query: q, results: [] });
        });
    }, PLAYER_SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const vbTeamIndex = useMemo(
    () => buildTeamIndex((teams || []).filter((team) => team.league === VOLLEYBALL)),
    [teams],
  );

  const groups = useMemo(() => {
    if (!q) {
      const favKeys = new Set(favorites.map((f) => `t:${f.league}:${f.id}`));
      const favResults = favorites.map((f) =>
        teamResult({ league: f.league, id: f.id, displayName: f.name, logo: f.logo }),
      );
      const recents = recent.filter((r) => !favKeys.has(r.key));
      return [
        { id: "favorites", label: t("search.favorites"), items: favResults },
        { id: "recent", label: t("search.recent"), items: recents },
      ].filter((g) => g.items.length > 0);
    }

    const teamItems = rankBy(
      teams || [],
      q,
      (team) => [team.displayName, team.shortDisplayName, team.location, team.abbreviation],
      MAX_TEAMS,
    ).map(teamResult);

    const basketball =
      espnPlayers.query === q
        ? espnPlayers.results.map((p) => ({
            key: `p:${p.league}:${p.id}`,
            kind: "player",
            name: p.displayName,
            sub: [p.team, getLeague(p.league).shortLabel].filter(Boolean).join(" · "),
            image: p.image,
            to: `/${p.league}/players/${p.id}`,
          }))
        : [];

    const volleyball = rankBy(vbPlayers, q, (p) => [p.name], MAX_PLAYERS)
      .map((p) => {
        const team = findTeam(vbTeamIndex, p.team);
        if (!team) return null;
        return {
          key: `vp:${team.id}:${playerSlug(p.name)}`,
          kind: "player",
          name: p.name,
          sub: [p.position, team.shortDisplayName || team.displayName, getLeague(team.league).shortLabel]
            .filter(Boolean)
            .join(" · "),
          image: team.logo,
          to: `/${team.league}/teams/${team.id}/players/${playerSlug(p.name)}`,
        };
      })
      .filter(Boolean);

    return [
      { id: "teams", label: t("search.teams"), items: teamItems },
      { id: "players", label: t("search.players"), items: [...basketball, ...volleyball].slice(0, MAX_PLAYERS) },
    ].filter((g) => g.items.length > 0);
  }, [q, teams, favorites, recent, espnPlayers, vbPlayers, vbTeamIndex, t]);

  const flat = groups.flatMap((g) => g.items);
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));

  function choose(result) {
    rememberResult(result);
    closeSearch();
    navigate(result.to);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length === 0) return;
      const next = (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length;
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && flat[activeIndex]) {
      e.preventDefault();
      choose(flat[activeIndex]);
    }
  }

  const searching = q.length > 0;
  const loadingTeams = teams === null;
  let offset = 0;

  return (
    <Modal onClose={closeSearch} label={t("search.title")} className="search-panel" overlayClassName="modal-top">
      <div className="search-input-row">
        <i className="fa-solid fa-magnifying-glass"></i>
        <input
          type="text"
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="search-list"
          aria-activedescendant={flat[activeIndex] ? `search-opt-${activeIndex}` : undefined}
          aria-label={t("search.title")}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        <kbd>Esc</kbd>
      </div>

      <div className="search-results" id="search-list" role="listbox" ref={listRef}>
        {groups.map((group) => (
          <div key={group.id} role="group" aria-label={group.label}>
            <div className="search-group-label">{group.label}</div>
            {group.items.map((item) => {
              const index = offset++;
              return (
                <div
                  key={item.key}
                  id={`search-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`search-item${index === activeIndex ? " is-active" : ""}`}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item)}
                >
                  {item.image ? (
                    <img src={item.image} alt="" className={`search-item-img${item.kind === "player" ? " round" : ""}`} />
                  ) : (
                    <span className="search-item-img round placeholder">
                      <i className="fa-solid fa-person"></i>
                    </span>
                  )}
                  <span className="search-item-text">
                    <span className="search-item-name">{item.name}</span>
                    <span className="search-item-sub">{item.sub}</span>
                  </span>
                  <i className="fa-solid fa-arrow-turn-down-left search-item-hint"></i>
                </div>
              );
            })}
          </div>
        ))}

        {flat.length === 0 && (
          <p className="search-empty">
            {!searching
              ? t("search.hint")
              : loadingTeams
                ? t("search.loading")
                : t("search.noResults", { query })}
          </p>
        )}

        {searching && flat.length > 0 && loadingTeams && <p className="search-empty">{t("search.loading")}</p>}
      </div>

      {searching && <p className="search-note">{t("search.volleyballNote")}</p>}
    </Modal>
  );
}
