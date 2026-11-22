# One-command setup for Windows (PowerShell). Run from the repository folder:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "== PTE Master AI setup =="
$missing = $false
foreach ($tool in @("docker", "node", "pnpm", "supabase", "python", "uv")) {
  if (Get-Command $tool -ErrorAction SilentlyContinue) { Write-Host "  ok       $tool" }
  else { Write-Host "  MISSING  $tool (see README > Requirements)"; $missing = $true }
}
if ($missing) { throw "Please install the missing tools, then run this script again." }

pnpm install --frozen-lockfile
Push-Location apps/api; uv sync --frozen; Pop-Location

supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta
python scripts/build_seed.py --check
supabase migration up

$status = supabase status -o json | ConvertFrom-Json
$anon = $status.ANON_KEY
function Make-Env($example, $target) {
  if (Test-Path $target) { Write-Host "  keep  $target"; return }
  (Get-Content $example) -replace "replace-with-anon-key-from-supabase-status", $anon -replace "^SUPABASE_ANON_KEY=replace-me", "SUPABASE_ANON_KEY=$anon" | Set-Content $target
  Write-Host "  wrote $target"
}
Make-Env ".env.example" ".env"
Make-Env "apps/web/.env.example" "apps/web/.env.local"
Make-Env "apps/api/.env.example" "apps/api/.env"

Write-Host ""
Write-Host "Setup finished. Next: docker compose up -d --build, then open http://localhost:3000"
