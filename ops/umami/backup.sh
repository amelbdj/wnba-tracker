#!/bin/bash
# Sauvegarde quotidienne de la base Umami.
# Export compressé dans /home/amel/umami-backups, gardé 14 jours.
# Les données sont pseudonymes et de toute façon purgées à 13 mois (purge.sh) :
# 14 jours de sauvegardes n'allongent donc pas la durée de conservation.
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/home/amel/umami-backups}"
KEEP_DAYS=14

umask 077
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%F)
TMP="$BACKUP_DIR/.umami-$STAMP.sql.gz.part"
OUT="$BACKUP_DIR/umami-$STAMP.sql.gz"

# Écrit dans un fichier temporaire, ne le garde que si tout s'est bien passé :
# un dump interrompu ne remplace jamais une bonne sauvegarde.
if ! docker compose exec -T db pg_dump -U umami --no-owner umami | gzip > "$TMP" || [ ! -s "$TMP" ]; then
  echo "$(date -Is) sauvegarde ÉCHOUÉE" >&2
  exit 1
fi
mv "$TMP" "$OUT"

find "$BACKUP_DIR" -name 'umami-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) sauvegarde OK : $OUT ($(du -h "$OUT" | cut -f1))"
