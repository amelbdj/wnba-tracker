// Contrôles quotidiens de FRONTROW (workflow n8n « frontrow-monitor »).
//
// Ce fichier est la source de la logique : le script scripts/buildN8nWorkflow.js
// l'insère tel quel dans le nœud « Code » du workflow, et scripts/n8nChecks.test.js
// le teste. Il doit donc rester AUTONOME : pas d'import, uniquement des
// déclarations de haut niveau. Seul le mot-clé `export` en début de ligne est
// retiré à l'insertion.
//
// Principe : une requête par source et par sport, sur des cibles STABLES.
//  - les scores sont lus sur un jour PASSÉ fixe (jamais vide, même hors saison) ;
//  - les classements sont lus tels quels (jamais vides pendant ni après la saison) ;
//  - chaque réponse doit contenir des champs clés, de bon type : si un fournisseur
//    renomme ou retire un champ, le contrôle échoue même si la réponse est « 200 ».

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_CORE = "https://site.api.espn.com/apis/v2/sports";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports";
const NCAA_PUBLIC = "https://ncaa-api.henrygd.me";
const SITE = "https://thefrontrow.fr";

// Jours passés fixes qui ont des matchs (vérifiés le 19 novembre 2026).
const DAY = {
  wnba: "20250805",
  ncaaBasketball: "20260215",
  ncaaVolleyball: "20251115",
  premiereLigue: "20260131",
  championsLeague: "20251112",
};

// Une feuille de match WNBA terminée (stable) et une joueuse connue.
const WNBA_FINISHED_EVENT = "401820327";
const WNBA_TEAM = "14";
const WNBA_PLAYER = "4433403";

// Types de champs reconnus par les règles.
export const TYPES = {
  str: (v) => typeof v === "string" && v.length > 0,
  num: (v) => typeof v === "number" && Number.isFinite(v),
  bool: (v) => typeof v === "boolean",
  obj: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  arr: (v) => Array.isArray(v),
  list: (v) => Array.isArray(v) && v.length > 0, // tableau NON vide
  any: (v) => v !== undefined && v !== null,
};

// get({a:{b:[{c:1}]}}, "a.b[0].c") -> 1
export function get(obj, path) {
  let cur = obj;
  for (const part of path.match(/[^.[\]]+/g) || []) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

// Les noms des statistiques d'une entrée de classement ESPN.
const statNames = (entry) => (entry?.stats || []).map((s) => s.name);
const has = (names, wanted) => wanted.filter((n) => !names.includes(n));

const EVENT_RULES = [
  ["events", "list"],
  ["events[0].id", "str"],
  ["events[0].date", "str"],
  ["events[0].status.type.state", "str"],
  ["events[0].competitions[0].competitors", "list"],
  ["events[0].competitions[0].competitors[0].team.id", "str"],
  ["events[0].competitions[0].competitors[0].team.displayName", "str"],
  ["events[0].competitions[0].competitors[0].score", "any"],
];

// `at` : où se trouve le premier groupe du classement. Le basket et le foot ont
// un seul niveau (children[0]) ; le volley par conférence en a un de plus
// (children[0].children[0]) — le site lit les deux avec collectGroups.
const standingsRules = (at = "children[0]") => [
  ["children", "list"],
  [`${at}.standings.entries`, "list"],
  [`${at}.standings.entries[0].team.id`, "str"],
  [`${at}.standings.entries[0].team.displayName`, "str"],
  [`${at}.standings.entries[0].stats`, "list"],
];

// Les statistiques que le site lit dans un classement (voir sortEntries et
// Standings.jsx) ; `wanted` = celles qui doivent exister.
const standingsStats = (wanted, at = "children[0]") => (json) => {
  const missing = has(statNames(get(json, `${at}.standings.entries[0]`)), wanted);
  return missing.length ? [`statistiques de classement absentes : ${missing.join(", ")}`] : [];
};

const ncaaPath = (p) => `${NCAA_PUBLIC}${p}`;

// group : sport ou source, pour regrouper les messages.
// severity "warn" : à signaler mais pas critique (ex. le relais de secours sert à la place du nôtre).
export const CHECKS = [
  // ---- ESPN : basketball
  {
    id: "espn-wnba-scoreboard",
    group: "Basket",
    label: "ESPN · WNBA · matchs d'un jour",
    url: `${ESPN}/basketball/wnba/scoreboard?dates=${DAY.wnba}`,
    rules: EVENT_RULES,
  },
  {
    id: "espn-wnba-standings",
    group: "Basket",
    label: "ESPN · WNBA · classement",
    url: `${ESPN_CORE}/basketball/wnba/standings`,
    rules: standingsRules(),
    custom: standingsStats(["wins", "losses", "winPercent"]),
  },
  {
    id: "espn-wnba-summary",
    group: "Basket",
    label: "ESPN · WNBA · feuille d'un match",
    url: `${ESPN}/basketball/wnba/summary?event=${WNBA_FINISHED_EVENT}`,
    rules: [
      ["boxscore.teams", "list"],
      ["boxscore.teams[0].team.id", "str"],
      ["boxscore.teams[0].statistics", "list"],
      ["header.competitions[0].status.type.completed", "bool"],
      ["header.competitions[0].competitors", "list"],
    ],
  },
  {
    id: "espn-wnba-team",
    group: "Basket",
    label: "ESPN · WNBA · fiche d'équipe",
    url: `${ESPN}/basketball/wnba/teams/${WNBA_TEAM}`,
    rules: [
      ["team.id", "str"],
      ["team.displayName", "str"],
      ["team.logos", "list"],
    ],
  },
  {
    id: "espn-wnba-roster",
    group: "Basket",
    label: "ESPN · WNBA · effectif",
    url: `${ESPN}/basketball/wnba/teams/${WNBA_TEAM}/roster`,
    rules: [
      ["athletes", "list"],
      ["athletes[0].id", "str"],
      ["athletes[0].displayName", "str"],
    ],
  },
  {
    id: "espn-wnba-athlete",
    group: "Basket",
    label: "ESPN · WNBA · fiche joueuse",
    url: `${ESPN_WEB}/basketball/wnba/athletes/${WNBA_PLAYER}`,
    rules: [
      ["athlete.id", "str"],
      ["athlete.displayName", "str"],
    ],
  },
  {
    id: "espn-ncaa-basketball-scoreboard",
    group: "Basket",
    label: "ESPN · NCAA basket · matchs d'un jour",
    url: `${ESPN}/basketball/womens-college-basketball/scoreboard?dates=${DAY.ncaaBasketball}`,
    rules: EVENT_RULES,
  },
  {
    id: "espn-search",
    group: "Basket",
    label: "ESPN · recherche de joueuses",
    url: "https://site.api.espn.com/apis/search/v2?query=clark&type=player&limit=5",
    rules: [["results", "list"]],
    custom: (json) => {
      const players = (get(json, "results") || []).find((r) => r.type === "player");
      return players && Array.isArray(players.contents) && players.contents.length > 0
        ? []
        : ["aucun résultat de type « player » pour « clark »"];
    },
  },

  // ---- ESPN : volley
  {
    id: "espn-ncaa-volleyball-scoreboard",
    group: "Volley",
    label: "ESPN · NCAA volley · matchs d'un jour",
    url: `${ESPN}/volleyball/womens-college-volleyball/scoreboard?dates=${DAY.ncaaVolleyball}`,
    rules: EVENT_RULES,
  },
  {
    id: "espn-ncaa-volleyball-standings",
    group: "Volley",
    label: "ESPN · NCAA volley · classement par conférence",
    url: `${ESPN_CORE}/volleyball/womens-college-volleyball/standings?level=3`,
    rules: standingsRules("children[0].children[0]"),
    // leagueWinPercent : le site range les équipes universitaires par bilan de conférence.
    custom: standingsStats(["wins", "losses", "winPercent", "leagueWinPercent"], "children[0].children[0]"),
  },

  // ---- ESPN : football
  {
    id: "espn-premiere-ligue-scoreboard",
    group: "Football",
    label: "ESPN · Première Ligue · matchs d'un jour",
    url: `${ESPN}/soccer/fra.w.1/scoreboard?dates=${DAY.premiereLigue}`,
    rules: EVENT_RULES,
  },
  {
    id: "espn-premiere-ligue-standings",
    group: "Football",
    label: "ESPN · Première Ligue · classement",
    url: `${ESPN_CORE}/soccer/fra.w.1/standings`,
    rules: standingsRules(),
    custom: standingsStats(["points", "gamesPlayed"]),
  },
  {
    id: "espn-champions-league-scoreboard",
    group: "Football",
    label: "ESPN · Ligue des champions · matchs d'un jour",
    url: `${ESPN}/soccer/uefa.wchampions/scoreboard?dates=${DAY.championsLeague}`,
    rules: EVENT_RULES,
  },

  // ---- Relais NCAA public (secours), lu directement : 3 requêtes par seconde au plus.
  {
    id: "ncaa-public-stats",
    group: "Volley",
    label: "Relais NCAA public · classement des joueuses",
    url: ncaaPath("/stats/volleyball-women/d1/current/individual/42"),
    spacingMs: 700,
    rules: [
      ["data", "list"],
      ["page", "num"],
      ["pages", "num"],
      ["title", "str"],
    ],
  },
  {
    id: "ncaa-public-scoreboard",
    group: "Volley",
    label: "Relais NCAA public · matchs d'un jour",
    url: ncaaPath("/scoreboard/volleyball-women/d1/2026/11/18"),
    spacingMs: 700,
    rules: [
      ["games", "list"],
      ["games[0].game.gameID", "str"],
      ["games[0].game.home.names.short", "str"],
      ["games[0].game.away.names.short", "str"],
    ],
  },
  {
    id: "ncaa-public-boxscore",
    group: "Volley",
    label: "Relais NCAA public · feuille de match",
    url: ncaaPath("/game/6627487/boxscore"),
    spacingMs: 700,
    rules: [
      ["teams", "list"],
      ["teamBoxscore", "list"],
      ["teamBoxscore[0].playerStats", "list"],
    ],
  },

  // ---- Notre propre chaîne
  {
    id: "site-home",
    group: "FRONTROW",
    label: "Site · page d'accueil",
    url: `${SITE}/`,
    html: '<div id="root">',
  },
  {
    id: "site-espn",
    group: "FRONTROW",
    label: "Site · point de passage ESPN",
    url: `${SITE}/api/espn?dates=${DAY.wnba}&kind=scoreboard&league=wnba`,
    rules: [["events", "list"]],
  },
  {
    // Une page de classement rarement demandée : sa copie en cache est périmée
    // depuis longtemps, donc la réponse vient vraiment du relais, et l'en-tête dit lequel.
    id: "site-ncaa",
    group: "FRONTROW",
    label: "Site · données NCAA (relais privé)",
    url: `${SITE}/api/ncaa/volleyball?stat=552&page=2`,
    rules: [["data", "list"]],
    warnIfHeader: { name: "x-ncaa-source", expected: "private", message: "le relais privé ne répond pas : c'est le relais public qui sert" },
  },
  {
    id: "umami",
    group: "FRONTROW",
    label: "Mesure d'audience (Umami)",
    url: "https://stats.thefrontrow.fr/api/heartbeat",
  },
];

// -> { ok, problems: string[], warnings: string[] } pour une réponse normalisée
// { status, headers (clés en minuscules), body (texte), json (objet ou null), error }.
export function evaluate(check, res) {
  if (res.error) return { ok: false, problems: [`injoignable (${res.error})`], warnings: [] };

  const problems = [];
  const warnings = [];
  if (res.status !== 200) {
    problems.push(`HTTP ${res.status}`);
    return { ok: false, problems, warnings };
  }

  if (check.html && !String(res.body || "").includes(check.html)) {
    problems.push("la page ne contient plus l'élément attendu");
  }

  if (check.rules || check.custom) {
    if (!res.json) {
      problems.push("la réponse n'est pas du JSON");
    } else {
      for (const [path, type] of check.rules || []) {
        if (!TYPES[type](get(res.json, path))) {
          problems.push(`champ « ${path} » absent ou de type inattendu (${type})`);
        }
      }
      if (check.custom) problems.push(...check.custom(res.json));
    }
  }

  if (!problems.length && check.warnIfHeader) {
    const { name, expected, message } = check.warnIfHeader;
    if (res.headers?.[name] !== expected) warnings.push(message);
  }

  return { ok: problems.length === 0, problems, warnings };
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `fetchOne(url)` -> réponse normalisée (voir evaluate). Les contrôles sans
// `spacingMs` partent ensemble ; les autres, l'un après l'autre.
export async function runChecks(fetchOne, checks = CHECKS) {
  const run = async (check) => {
    const started = Date.now();
    let res;
    try {
      res = await fetchOne(check.url);
    } catch (err) {
      res = { error: String((err && err.message) || err).slice(0, 120) };
    }
    return { id: check.id, group: check.group, label: check.label, ms: Date.now() - started, ...evaluate(check, res) };
  };

  const spaced = checks.filter((c) => c.spacingMs);
  const parallel = checks.filter((c) => !c.spacingMs);

  const spacedRun = (async () => {
    const out = [];
    for (const check of spaced) {
      out.push(await run(check));
      await pause(check.spacingMs);
    }
    return out;
  })();

  const [first, second] = await Promise.all([Promise.all(parallel.map(run)), spacedRun]);
  const byId = new Map([...first, ...second].map((r) => [r.id, r]));
  return checks.map((c) => byId.get(c.id)); // dans l'ordre de la liste
}

const FR_DAY = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" });
const FR_DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });
const ISO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ

const daysBetween = (isoA, isoB) => Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86_400_000);

// Décide du message à envoyer, et de l'état à retenir pour la prochaine fois.
//   state : { failing: { [id]: { since: "AAAA-MM-JJ", severity } }, lastWeeklyOk: "AAAA-MM-JJ" }
//   -> { message: string | null, state }
// On écrit à chaque exécution où quelque chose ne va pas (rappel quotidien), une
// fois quand un contrôle est rétabli, et le lundi quand tout va bien : sans ce
// message hebdomadaire, impossible de savoir si le contrôle lui-même s'est arrêté.
export function plan(results, previous = {}, now = new Date()) {
  const today = ISO_DAY.format(now);
  const before = previous.failing || {};

  const failing = {};
  const lines = { errors: [], warns: [] };
  for (const r of results) {
    const severity = !r.ok ? "error" : r.warnings.length ? "warn" : null;
    if (!severity) continue;
    const since = before[r.id]?.since || today;
    failing[r.id] = { since, severity };
    const reasons = [...r.problems, ...(r.ok ? r.warnings : [])].join(" ; ");
    const age = daysBetween(since, today);
    const tag = age === 0 ? "nouveau" : `depuis ${age} jour${age > 1 ? "s" : ""}`;
    (severity === "error" ? lines.errors : lines.warns).push(`• ${r.label} : ${reasons} (${tag})`);
  }

  const recovered = results.filter((r) => before[r.id] && !failing[r.id]);
  const isMonday = FR_DAY.format(now).startsWith("lun");
  const weeklyDue = isMonday && previous.lastWeeklyOk !== today;
  const allGood = Object.keys(failing).length === 0;

  const state = { failing, lastWeeklyOk: previous.lastWeeklyOk };
  const parts = [];

  if (lines.errors.length) {
    parts.push(`🔴 **FRONTROW — ${lines.errors.length} contrôle${lines.errors.length > 1 ? "s" : ""} en échec** (${FR_DATE.format(now)})`, ...lines.errors);
  }
  if (lines.warns.length) {
    parts.push(`🟠 **À surveiller**`, ...lines.warns);
  }
  if (recovered.length) {
    parts.push(`🟢 **Rétabli** : ${recovered.map((r) => r.label).join(" ; ")}`);
  }
  if (allGood && weeklyDue) {
    parts.push(`✅ **FRONTROW — tout va bien** : ${results.length} contrôles réussis (${FR_DATE.format(now)}). Message hebdomadaire : s'il n'arrive plus un lundi, c'est le contrôle lui-même qui est à vérifier.`);
    state.lastWeeklyOk = today;
  }

  let message = parts.length ? parts.join("\n") : null;
  if (message && message.length > 1900) message = `${message.slice(0, 1890)}\n…`; // limite de Discord : 2000
  return { message, state };
}
