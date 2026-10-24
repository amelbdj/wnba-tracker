import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTeamSchedule } from "../services/api";
import { toLocale } from "../utils/locale";
import { toMatch } from "../utils/teamMatches";
import GameDetails from "./GameDetails";
import TeamLink from "./TeamLink";

const PAGE_SIZE = 8;

// Page numbers to show: always the first and last, and the pages next to the
// current one, with null standing for a gap ("1 … 4 5 6 … 9").
function pageNumbers(current, total) {
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
}

function Pager({ page, pages, onChange }) {
  const { t } = useTranslation();
  if (pages <= 1) return null;

  return (
    <nav className="pager" aria-label={t("team.pagination")}>
      <button
        className="pager-btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label={t("team.previousPage")}
      >
        <i className="fa-solid fa-chevron-left"></i>
      </button>
      {pageNumbers(page, pages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="pager-gap">
            …
          </span>
        ) : (
          <button
            key={p}
            className={`pager-btn${p === page ? " active" : ""}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        className="pager-btn"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        aria-label={t("team.nextPage")}
      >
        <i className="fa-solid fa-chevron-right"></i>
      </button>
    </nav>
  );
}

// A team's season match by match: results and upcoming matches, each opening
// the match detail.
export default function TeamMatches({ league, teamId }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ status: "loading" });
  const [tab, setTab] = useState(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTeamSchedule(league, teamId)
      .then((events) => {
        if (!cancelled) {
          setState({ status: "ready", events });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [league, teamId]);

  if (state.status === "error") return null;

  const locale = toLocale(i18n.language);
  const matches = (state.events || []).map((e) => toMatch(e, teamId, t)).filter(Boolean);
  const played = matches.filter((m) => m.state === "final" || m.state === "other").reverse();
  const coming = matches.filter((m) => m.state === "live" || m.state === "upcoming");
  const active = tab || (coming.length && !played.length ? "upcoming" : "results");
  const all = active === "upcoming" ? coming : played;
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const switchTab = (next) => {
    setTab(next);
    setPage(1);
  };

  const dateLabel = (m) =>
    new Date(m.date).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const timeLabel = (m) =>
    new Date(m.date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <span className="section-eyebrow">
            <i className="fa-regular fa-calendar"></i> {t("team.matches")}
          </span>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="skeleton skeleton-card" style={{ height: 180 }}></div>
      ) : (
        <>
          <div className="chip-group" style={{ marginBottom: 14 }}>
            <button className={`chip${active === "results" ? " active" : ""}`} onClick={() => switchTab("results")}>
              {t("team.matchesResults", { count: played.length })}
            </button>
            <button className={`chip${active === "upcoming" ? " active" : ""}`} onClick={() => switchTab("upcoming")}>
              {t("team.matchesUpcoming", { count: coming.length })}
            </button>
          </div>

          {all.length === 0 ? (
            <p className="vb-note">{t(active === "upcoming" ? "team.noUpcoming" : "team.noResults")}</p>
          ) : (
            <>
              <div className="games-log">
                {rows.map((m) => (
                  <div
                    key={m.id}
                    className="games-log-row team-match-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(m.id)}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(m.id)}
                  >
                    {m.state === "final" ? (
                      <span className={`games-log-result ${m.won ? "win" : "loss"}`}>{m.won ? "W" : "L"}</span>
                    ) : m.state === "live" ? (
                      <span className="games-log-result live">
                        <span className="dot"></span>
                      </span>
                    ) : (
                      <span className="games-log-result neutral">–</span>
                    )}

                    <div className="team-match-opponent">
                      {m.opponent.logo && <img src={m.opponent.logo} alt="" />}
                      <div className="team-match-text">
                        <TeamLink league={league} teamId={m.opponent.id} className="team-match-name">
                          {m.opponent.displayName}
                        </TeamLink>
                        <span className="team-match-meta">
                          {m.neutral ? t("team.neutral") : m.home ? t("team.home") : t("team.away")}
                          {" · "}
                          {dateLabel(m)}
                          {(m.state === "upcoming" || m.state === "live") && ` · ${timeLabel(m)}`}
                          {m.phase && <span className={`team-match-phase ${m.phase}`}>{t(`team.${m.phase}`)}</span>}
                        </span>
                      </div>
                    </div>

                    <span className="team-match-score">
                      {m.state === "final" || m.state === "live"
                        ? `${m.score[0]}-${m.score[1]}`
                        : m.note || ""}
                    </span>
                  </div>
                ))}
              </div>
              <Pager page={current} pages={pages} onChange={setPage} />
            </>
          )}
        </>
      )}

      {openId && <GameDetails gameId={openId} league={league} onClose={() => setOpenId(null)} />}
    </div>
  );
}
