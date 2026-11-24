#!/usr/bin/env bash
# Restore a backup made by scripts/backup.sh. This REPLACES all current local data.
# Usage: scripts/restore.sh DIR [--yes]      (make restore DIR=backups/<date>)
set -euo pipefail
cd "$(dirname "$0")/.."
DB_CONTAINER="${DB_CONTAINER:-supabase_db_tutorbot-english-ai}"
dir="${1:?usage: restore.sh BACKUP_DIR [--yes]}"
[ -f "$dir/db.dump" ] || { echo "No db.dump in $dir" >&2; exit 1; }
if [ "${2:-}" != "--yes" ]; then
  read -r -p "This replaces ALL local accounts, progress and recordings with the backup. Type 'yes' to continue: " ans
  [ "$ans" = "yes" ] || { echo "Cancelled."; exit 0; }
fi
# Fresh schema from the migrations, without the content seed (the backup holds the content as it was)
supabase db reset --no-seed >/dev/null
# Triggers are off while loading, so the signup trigger does not create duplicate profiles
docker exec -i "$DB_CONTAINER" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers \
  --single-transaction --exit-on-error < "$dir/db.dump"
if [ -f "$dir/recordings.tar.gz" ]; then
  rm -rf recordings
  tar -xzf "$dir/recordings.tar.gz"
fi
echo "Restored from $dir. Restart the API (make start) so it reconnects."
