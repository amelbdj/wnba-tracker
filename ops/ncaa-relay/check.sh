#!/bin/bash
# Contrôle le relais NCAA : protection par jeton, lecture de ncaa.com, et
# comparaison avec le relais public (ncaa-api.henrygd.me).
#
#   ./check.sh                          -> teste http://127.0.0.1:3011 (sur le VPS)
#   ./check.sh https://ncaa.thefrontrow.fr  -> teste l'adresse publique
#
# Le jeton est lu dans ./.env (ou dans NCAA_HEADER_KEY) et n'est jamais affiché.
# C'est aussi le test de connectivité : si ncaa.com refuse l'adresse du VPS,
# les lectures ci-dessous échouent.
set -uo pipefail
cd "$(dirname "$0")"

BASE="${1:-http://127.0.0.1:3011}"
PUBLIC="https://ncaa-api.henrygd.me"
KEY="${NCAA_HEADER_KEY:-}"
if [ -z "$KEY" ] && [ -f .env ]; then
  KEY=$(grep -E '^NCAA_HEADER_KEY=' .env | head -1 | cut -d= -f2-)
fi
[ -n "$KEY" ] || { echo "Jeton introuvable (.env ou NCAA_HEADER_KEY)."; exit 2; }
command -v python3 >/dev/null || { echo "python3 est requis."; exit 2; }

FAILS=0
ok()   { echo "  OK    $1"; }
fail() { echo "  ÉCHEC $1"; FAILS=$((FAILS + 1)); }

# Corps de la réponse -> fichier $2, code HTTP -> stdout. $3 = jeton (facultatif).
get() {
  local args=(-s -m 25 -o "$2" -w '%{http_code}')
  [ -n "${3:-}" ] && args+=(-H "x-ncaa-key: $3")
  curl "${args[@]}" "$1"
}

# Clés de premier niveau du JSON d'un fichier, triées (vide si ce n'est pas du JSON).
keys_of() {
  python3 - "$1" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    print(",".join(sorted(d.keys())) if isinstance(d, dict) else "liste")
except Exception:
    print("")
PY
}

echo "Relais testé : $BASE"
echo
echo "1. Protection par jeton"
code=$(get "$BASE/stats/volleyball-women/d1/current/individual/42" /tmp/ncaa-noauth.json)
[ "$code" = "401" ] && ok "sans jeton : 401" || fail "sans jeton : HTTP $code (401 attendu)"
code=$(get "$BASE/stats/volleyball-women/d1/current/individual/42" /tmp/ncaa-badauth.json "mauvais-jeton")
[ "$code" = "401" ] && ok "mauvais jeton : 401" || fail "mauvais jeton : HTTP $code (401 attendu)"

# Un jour récent avec des matchs, pour trouver un identifiant de match.
DAY_PATHS=$(python3 - <<'PY'
import datetime
today = datetime.date.today()
print(" ".join((today - datetime.timedelta(days=i)).strftime("%Y/%m/%d") for i in range(1, 9)))
PY
)

PATHS=("/stats/volleyball-women/d1/current/individual/42")
GAME_ID=""
for day in $DAY_PATHS; do
  code=$(get "$BASE/scoreboard/volleyball-women/d1/$day" /tmp/ncaa-sb.json "$KEY")
  if [ "$code" = "200" ]; then
    GAME_ID=$(python3 - <<'PY'
import json
try:
    d = json.load(open("/tmp/ncaa-sb.json"))
    games = d.get("games") or []
    print(games[0]["game"]["gameID"] if games else "")
except Exception:
    print("")
PY
)
    if [ -n "$GAME_ID" ]; then PATHS+=("/scoreboard/volleyball-women/d1/$day" "/game/$GAME_ID/boxscore"); break; fi
  fi
done

echo
echo "2. Lecture de ncaa.com par le relais, comparée au relais public"
[ -z "$GAME_ID" ] && fail "aucun match trouvé sur les 8 derniers jours (scoreboard)"
for p in "${PATHS[@]}"; do
  c1=$(get "$BASE$p" /tmp/ncaa-mine.json "$KEY")
  sleep 1   # le relais public limite à 3 requêtes par seconde
  c2=$(get "$PUBLIC$p" /tmp/ncaa-public.json)
  k1=$(keys_of /tmp/ncaa-mine.json)
  k2=$(keys_of /tmp/ncaa-public.json)
  if [ "$c1" != "200" ] || [ -z "$k1" ]; then
    fail "$p : le relais répond HTTP $c1 (JSON : ${k1:-non})"
  elif [ "$c2" = "200" ] && [ "$k1" != "$k2" ]; then
    fail "$p : structure différente du relais public ($k1 / $k2)"
  else
    ok "$p : HTTP 200, champs : $k1"
  fi
done

echo
if [ "$FAILS" -eq 0 ]; then echo "RÉSULTAT : tout est bon."; else echo "RÉSULTAT : $FAILS échec(s)."; fi
rm -f /tmp/ncaa-noauth.json /tmp/ncaa-badauth.json /tmp/ncaa-sb.json /tmp/ncaa-mine.json /tmp/ncaa-public.json
exit "$FAILS"
