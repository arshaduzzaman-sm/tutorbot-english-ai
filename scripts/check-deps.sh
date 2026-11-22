#!/usr/bin/env bash
# Checks the tools needed to run PTE Master AI locally and prints install help.
set -uo pipefail
missing=0
need() { # name, command, help
  if command -v "$2" >/dev/null 2>&1; then
    printf '  ok       %-14s %s\n' "$1" "$($2 --version 2>&1 | head -1)"
  else
    printf '  MISSING  %-14s %s\n' "$1" "$3"; missing=1
  fi
}
echo "Checking tools..."
need Docker docker "Install Docker Desktop: https://docs.docker.com/get-docker/"
need Node node "Install Node.js 20+ : https://nodejs.org/"
need pnpm pnpm "Run: corepack enable  (or npm install -g pnpm)"
need Supabase supabase "Install the Supabase CLI: https://supabase.com/docs/guides/local-development/cli/getting-started"
need Python python3 "Install Python 3.12+: https://www.python.org/downloads/"
need uv uv "Install uv: https://docs.astral.sh/uv/getting-started/installation/"
if command -v docker >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  echo "  Docker is installed but not running. Start Docker Desktop and try again."; missing=1
fi
exit $missing
