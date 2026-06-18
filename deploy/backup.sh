#!/usr/bin/env bash
# =====================================================================
# Backup de Postgres a object storage (Cloudflare R2 / Backblaze B2) con rclone.
# Pensado para correr por cron en la VM de produccion.
#
# Requisitos:
#   - rclone instalado y un remote configurado (ej "r2"):  rclone config
#   - el contenedor de la DB corriendo (pedidos_db)
#
# Uso:
#   RCLONE_REMOTE=r2:pedidos-backups bash deploy/backup.sh
# Programar a diario (symlink en cron.daily):
#   sudo ln -sf "$PWD/deploy/backup.sh" /etc/cron.daily/pedidos-backup
# =====================================================================
set -euo pipefail

RCLONE_REMOTE="${RCLONE_REMOTE:-r2:pedidos-backups}"   # remote:bucket[/prefijo]
DB_CONTAINER="${DB_CONTAINER:-pedidos_db}"
DB_USER="${POSTGRES_USER:-pedidos}"
DB_NAME="${POSTGRES_DB:-pedidos}"
LOCAL_DIR="${LOCAL_DIR:-/var/backups/pedidos}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$LOCAL_DIR"
TS=$(date +%Y%m%d-%H%M%S)
FILE="$LOCAL_DIR/db-$TS.sql.gz"

echo "[backup] dump -> $FILE"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

echo "[backup] subiendo a $RCLONE_REMOTE"
rclone copy "$FILE" "$RCLONE_REMOTE" --no-traverse

echo "[backup] limpiando backups locales de mas de $KEEP_DAYS dias"
find "$LOCAL_DIR" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "[backup] ok"
