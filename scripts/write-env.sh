#!/usr/bin/env bash
# Creates .env, apps/web/.env.local and apps/api/.env from the examples, filling in
# the public local Supabase keys from `supabase status`. Existing files are kept.
set -euo pipefail
cd "$(dirname "$0")/.."

status_json=$(supabase status -o json 2>/dev/null) || { echo "Supabase is not running. Run: supabase start" >&2; exit 1; }
anon=$(printf '%s' "$status_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["ANON_KEY"])')

make_env() { # $1 example, $2 target
  if [ -f "$2" ]; then echo "  keep  $2 (already exists)"; return; fi
  sed -e "s#replace-with-anon-key-from-supabase-status#${anon}#" -e "s#^SUPABASE_ANON_KEY=replace-me#SUPABASE_ANON_KEY=${anon}#" "$1" > "$2"
  echo "  wrote $2"
}
make_env .env.example .env
make_env apps/web/.env.example apps/web/.env.local
make_env apps/api/.env.example apps/api/.env
