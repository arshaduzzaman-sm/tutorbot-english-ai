#!/usr/bin/env bash
# One-command setup for macOS and Linux (make setup runs this).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== TutorBot English AI setup =="
scripts/check-deps.sh || { echo; echo "Please install the missing tools above, then run make setup again."; exit 1; }

echo "== Installing app dependencies =="
pnpm install --frozen-lockfile
(cd apps/api && uv sync --frozen)

echo "== AI models =="
scripts/download-models.sh

echo "== Starting local Supabase (first run downloads Docker images, this can take a while) =="
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta

echo "== Applying new database migrations (first start also loads seed data) =="
python3 scripts/build_seed.py --check
supabase migration up

echo "== Writing .env files =="
scripts/write-env.sh

echo
echo "Setup finished. Next: make start, then open http://localhost:3000"
echo "Demo accounts (local only): demo.student@example.test / DemoStudent-123!   demo.admin@example.test / DemoAdmin-123!"
