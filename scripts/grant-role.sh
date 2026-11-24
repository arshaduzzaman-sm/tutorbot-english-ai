#!/usr/bin/env bash
# Give a registered user a staff role in the LOCAL database: scripts/grant-role.sh EMAIL [admin|content_editor]
# (make admin EMAIL=you@example.com). The user must sign out and in again to see the admin area.
set -euo pipefail
email="${1:?usage: grant-role.sh EMAIL [admin|content_editor]}"
role="${2:-admin}"
case "$role" in admin|content_editor) ;; *) echo "role must be admin or content_editor" >&2; exit 2 ;; esac
db_url="${DATABASE_URL_PSQL:-postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@127.0.0.1:54322/postgres}"
sql="insert into public.user_roles (user_id, role)
     select id, :'role'::public.app_role from auth.users where lower(email) = lower(:'email')
     on conflict do nothing returning user_id;"
run() {
  if command -v psql >/dev/null 2>&1; then
    psql "$db_url" -v ON_ERROR_STOP=1 -v email="$email" -v role="$role" -Atq
  else
    docker exec -i supabase_db_tutorbot-english-ai psql -U postgres -v ON_ERROR_STOP=1 -v email="$email" -v role="$role" -Atq
  fi
}
found=$(printf '%s\n' "select count(*) from auth.users where lower(email) = lower(:'email');" | run)
if [ "$found" != "1" ]; then echo "No account with email $email. Register first." >&2; exit 1; fi
printf '%s\n' "$sql" | run >/dev/null
echo "$email now has the $role role."
