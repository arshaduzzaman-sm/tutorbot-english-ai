#!/usr/bin/env bash
# Local backup: all accounts, progress, content and recordings -> backups/<date>/ (git-ignored).
# Usage: scripts/backup.sh [OUT_DIR]      (make backup)
# Restore with scripts/restore.sh DIR   (make restore DIR=backups/<date>)
set -euo pipefail
cd "$(dirname "$0")/.."
DB_CONTAINER="${DB_CONTAINER:-supabase_db_tutorbot-english-ai}"
out="${1:-backups/$(date -u +%Y%m%d-%H%M%S)}"
mkdir -p "$out"
chmod 700 "$out"
if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "The database is not running. Start it with: make start" >&2
  exit 1
fi
# Data only: the schema comes from supabase/migrations on restore. The database's own pg_dump matches its version.
docker exec "$DB_CONTAINER" pg_dump -U supabase_admin -d postgres --data-only -Fc \
  --schema=public --schema=auth --exclude-table-data=auth.schema_migrations > "$out/db.dump"
if [ -d recordings ] && [ -n "$(ls -A recordings 2>/dev/null)" ]; then
  tar -czf "$out/recordings.tar.gz" recordings
fi
migrations=$(ls supabase/migrations | tr '\n' ' ')
cat > "$out/manifest.txt" <<MANIFEST
created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
app_version=$(git describe --tags --always 2>/dev/null || echo unknown)
migrations=$migrations
MANIFEST
chmod 600 "$out"/*
echo "Backup written to $out ($(du -sh "$out" | cut -f1)). It contains personal data: keep it private."
