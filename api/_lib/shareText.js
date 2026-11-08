// What link previews say, per language. The server doesn't know the visitor's
// language (the app keeps it in the browser), so previews are French unless
// the link carries ?lang=en|es.
export const LANGS = ["fr", "en", "es"];
export const DEFAULT_LANG = "fr";

export const OG_LOCALE = { fr: "fr_FR", en: "en_US", es: "es_ES" };

export const SITE_TITLE = "FRONTROW — The home of women's sports.";

const TEXT = {
  fr: {
    card: {
      sectionPill: { "": "Scores en direct", standings: "Classement", playoffs: "Playoffs", teams: "Équipes", players: "Joueuses", statistics: "Stats" },
      teamTagline: "Calendrier · Résultats · Effectif · Stats",
      playerTagline: "Stats de la saison · Derniers matchs",
      volleyballPlayerTagline: "Stats de la saison · Match par match",
      leagueTagline: "Scores · Classement · Équipes · Stats",
      season: "Saison {year}",
    },
    siteDescription:
      "Scores en direct, classements, équipes et statistiques de la WNBA, de la NCAA, du volley universitaire, de la FIBA et des Jeux Olympiques.",
    leagues: {
      wnba: "WNBA",
      "womens-college-basketball": "NCAA Basket Femmes",
      "womens-college-volleyball": "NCAA Volley Femmes",
      fiba: "Coupe du monde FIBA",
      "womens-olympics-basketball": "Jeux Olympiques",
      "fra.w.1": "Première Ligue",
      "uefa.wchampions": "Ligue des champions féminine",
      "usa.nwsl": "NWSL",
      "eng.w.1": "Super League anglaise",
      "esp.w.1": "Liga F",
      "fifa.wwc": "Coupe du monde féminine",
    },
    sections: {
      "": { title: "{league} — Scores et résultats", description: "{league} : les matchs du jour, les scores en direct, le classement, les équipes et les stats." },
      standings: { title: "Classement {league}", description: "{league} : le classement complet, mis à jour en direct." },
      playoffs: { title: "Playoffs {league}", description: "{league} : le tableau des playoffs, avec les séries et les résultats en direct." },
      teams: { title: "Équipes {league}", description: "{league} : toutes les équipes, avec calendrier, résultats, effectif et bilan." },
      players: { title: "Joueuses {league}", description: "{league} : profils des joueuses, stats de la saison et derniers matchs." },
      statistics: { title: "Stats {league}", description: "{league} : les meilleures performances, catégorie par catégorie." },
    },
    team: { title: "{name} — {league}", description: "{name} ({league}) : calendrier, résultats, effectif et stats." },
    teamFallback: { title: "Équipe — {league}", description: "{league} : calendrier, résultats, effectif et stats de l'équipe." },
    player: { title: "{name} — {team}", description: "{name} ({team}, {league}) : stats de la saison et derniers matchs." },
    playerNoTeam: { title: "{name} — {league}", description: "{name} ({league}) : stats de la saison et derniers matchs." },
    playerFallback: { title: "Joueuse — {league}", description: "{league} : stats de la saison et derniers matchs de la joueuse." },
    volleyballPlayer: { description: "{name} ({team}) : stats de la saison, moyennes par set et match par match." },
    pages: {
      privacy: { title: "Politique de confidentialité", description: "Comment FRONTROW traite vos données." },
      terms: { title: "Conditions d'utilisation", description: "Les conditions d'utilisation de FRONTROW." },
    },
  },
  en: {
    card: {
      sectionPill: { "": "Live scores", standings: "Standings", playoffs: "Playoffs", teams: "Teams", players: "Players", statistics: "Stats" },
      teamTagline: "Schedule · Results · Roster · Stats",
      playerTagline: "Season stats · Recent games",
      volleyballPlayerTagline: "Season stats · Match by match",
      leagueTagline: "Scores · Standings · Teams · Stats",
      season: "{year} season",
    },
    siteDescription:
      "Live scores, standings, teams and stats for the WNBA, NCAA, college volleyball, FIBA and the Olympics.",
    leagues: {
      wnba: "WNBA",
      "womens-college-basketball": "NCAA Women's Basketball",
      "womens-college-volleyball": "NCAA Women's Volleyball",
      fiba: "FIBA World Cup",
      "womens-olympics-basketball": "Olympics",
      "fra.w.1": "French Première Ligue",
      "uefa.wchampions": "UEFA Women's Champions League",
      "usa.nwsl": "NWSL",
      "eng.w.1": "English Women's Super League",
      "esp.w.1": "Spanish Liga F",
      "fifa.wwc": "FIFA Women's World Cup",
    },
    sections: {
      "": { title: "{league} — Scores and results", description: "{league}: today's games, live scores, standings, teams and stats." },
      standings: { title: "{league} standings", description: "{league}: the full standings, updated live." },
      playoffs: { title: "{league} playoffs", description: "{league}: the playoff bracket, with series and live results." },
      teams: { title: "{league} teams", description: "{league}: every team, with schedule, results, roster and record." },
      players: { title: "{league} players", description: "{league}: player profiles, season stats and recent games." },
      statistics: { title: "{league} stats", description: "{league}: the best performances, category by category." },
    },
    team: { title: "{name} — {league}", description: "{name} ({league}): schedule, results, roster and stats." },
    teamFallback: { title: "Team — {league}", description: "{league}: the team's schedule, results, roster and stats." },
    player: { title: "{name} — {team}", description: "{name} ({team}, {league}): season stats and recent games." },
    playerNoTeam: { title: "{name} — {league}", description: "{name} ({league}): season stats and recent games." },
    playerFallback: { title: "Player — {league}", description: "{league}: the player's season stats and recent games." },
    volleyballPlayer: { description: "{name} ({team}): season stats, per-set averages and match-by-match log." },
    pages: {
      privacy: { title: "Privacy Policy", description: "How FRONTROW handles your data." },
      terms: { title: "Terms of Service", description: "FRONTROW's terms of service." },
    },
  },
  es: {
    card: {
      sectionPill: { "": "Resultados en directo", standings: "Clasificación", playoffs: "Playoffs", teams: "Equipos", players: "Jugadoras", statistics: "Estadísticas" },
      teamTagline: "Calendario · Resultados · Plantilla · Estadísticas",
      playerTagline: "Estadísticas de la temporada · Últimos partidos",
      volleyballPlayerTagline: "Estadísticas de la temporada · Partido a partido",
      leagueTagline: "Resultados · Clasificación · Equipos · Estadísticas",
      season: "Temporada {year}",
    },
    siteDescription:
      "Resultados en directo, clasificaciones, equipos y estadísticas de la WNBA, la NCAA, el voleibol universitario, la FIBA y los Juegos Olímpicos.",
    leagues: {
      wnba: "WNBA",
      "womens-college-basketball": "Baloncesto femenino NCAA",
      "womens-college-volleyball": "Voleibol femenino NCAA",
      fiba: "Copa del Mundo FIBA",
      "womens-olympics-basketball": "Juegos Olímpicos",
      "fra.w.1": "Première Ligue (Francia)",
      "uefa.wchampions": "Liga de Campeones femenina",
      "usa.nwsl": "NWSL",
      "eng.w.1": "Women's Super League (Inglaterra)",
      "esp.w.1": "Liga F",
      "fifa.wwc": "Copa Mundial Femenina",
    },
    sections: {
      "": { title: "{league} — Resultados", description: "{league}: los partidos de hoy, resultados en directo, clasificación, equipos y estadísticas." },
      standings: { title: "Clasificación {league}", description: "{league}: la clasificación completa, actualizada en directo." },
      playoffs: { title: "Playoffs {league}", description: "{league}: el cuadro de playoffs, con series y resultados en directo." },
      teams: { title: "Equipos {league}", description: "{league}: todos los equipos, con calendario, resultados, plantilla y balance." },
      players: { title: "Jugadoras {league}", description: "{league}: perfiles de las jugadoras, estadísticas de la temporada y últimos partidos." },
      statistics: { title: "Estadísticas {league}", description: "{league}: las mejores actuaciones, categoría por categoría." },
    },
    team: { title: "{name} — {league}", description: "{name} ({league}): calendario, resultados, plantilla y estadísticas." },
    teamFallback: { title: "Equipo — {league}", description: "{league}: calendario, resultados, plantilla y estadísticas del equipo." },
    player: { title: "{name} — {team}", description: "{name} ({team}, {league}): estadísticas de la temporada y últimos partidos." },
    playerNoTeam: { title: "{name} — {league}", description: "{name} ({league}): estadísticas de la temporada y últimos partidos." },
    playerFallback: { title: "Jugadora — {league}", description: "{league}: estadísticas de la temporada y últimos partidos de la jugadora." },
    volleyballPlayer: { description: "{name} ({team}): estadísticas de la temporada, promedios por set y partido a partido." },
    pages: {
      privacy: { title: "Política de privacidad", description: "Cómo FRONTROW trata tus datos." },
      terms: { title: "Condiciones de uso", description: "Las condiciones de uso de FRONTROW." },
    },
  },
};

export function textFor(lang) {
  return TEXT[LANGS.includes(lang) ? lang : DEFAULT_LANG];
}

// "{name} — {league}" + { name, league } -> "Nebraska — NCAA Volley Femmes"
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}
