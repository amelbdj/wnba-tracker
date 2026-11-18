#!/bin/bash
# Purge quotidienne : supprime les données d'audience de plus de 13 mois.
# (La CNIL recommande de ne pas dépasser 25 mois pour les données collectées ;
# on s'impose 13 mois, comme pour la durée de vie des traceurs.)
#
# Le schéma d'Umami n'a pas de clés étrangères : chaque table est vidée
# explicitement, dans une seule transaction.
set -euo pipefail

cd "$(dirname "$0")"
RETENTION="${RETENTION:-13 months}"

docker compose exec -T db psql -U umami -d umami -v ON_ERROR_STOP=1 -v retention="$RETENTION" <<'SQL'
BEGIN;
DELETE FROM event_data    WHERE created_at < now() - :'retention'::interval;
DELETE FROM website_event WHERE created_at < now() - :'retention'::interval;
DELETE FROM session_data  WHERE created_at < now() - :'retention'::interval;
-- Une session n'est supprimée que si plus aucun événement ne s'y rattache.
DELETE FROM session s
 WHERE s.created_at < now() - :'retention'::interval
   AND NOT EXISTS (SELECT 1 FROM website_event e WHERE e.session_id = s.session_id);
COMMIT;
SQL

echo "$(date -Is) purge OK (conservation : $RETENTION)"
