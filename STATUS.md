# STATUS

**Current milestone:** M1 Foundation (branch `m1-foundation`) · **Last updated:** 2026-11-22

## M1 acceptance criteria
- [x] `make setup` then `make start` runs the full app locally with no API keys (tested on Linux; see Known issues)
- [x] Dashboard loads with one GraphQL query; GraphQL permission tests pass
- [x] Register → verification email (local mail viewer) → verify → login → logout → reset password (e2e)
- [x] Protected pages redirect logged-out users; FastAPI rejects requests without a valid JWT (tested)
- [x] Onboarding saves level and target score to `profiles` (API + e2e tests)
- [x] Dashboard shows real DB data and correct empty states for a new user
- [x] RLS tests prove one user cannot read another user's data
- [x] Landing page responsive (375 px), passes axe (WCAG 2.2 AA tags), shows Pearson disclaimer
- [ ] Backend, frontend and e2e tests pass **in GitHub CI** (workflow written; no GitHub repo yet, so not run in CI)

## Test results (2026-11-22, local)
- Backend `pytest -q`: 43 passed (26 unit/security, 17 integration with RLS + GraphQL)
- Frontend `vitest`: 16 passed · `tsc` and `eslint`: clean · `ruff`, `mypy --strict`: clean
- E2E Playwright against the Docker stack (`make setup` + `make start` from clean): 19 passed (desktop + 375 px)
- Memory: whole running stack (Supabase + API + web) uses about 0.6 GB RAM

## Content counts
- Levels: 6 · Lessons: 5 (Level 1) · Question types: 22 · Sample questions: 44 (2 per type)

## Next step
1. Owner: create the empty public GitHub repo `tutorbot-english-ai`; then push and confirm CI is green (last M1 box).
2. Then merge `m1-foundation` → `main`, create `m2-learning`, write the M2 plan here.

## Open questions / items for the owner
- **Legal:** product renamed to TutorBot English AI. Still get advice on descriptive use of "PTE" (docs/LEGAL_NOTES.md).
- **Privacy/terms pages** are templates, marked "to be reviewed by a lawyer".
- **Unverified:** official CEFR-to-PTE score mapping. Pearson's 2025 update page says the CEFR alignment is
  unchanged but gives no table, so the app shows CEFR levels only (no PTE ranges).
- **Unverified:** scoring-criteria names stored on sample questions (e.g. "Oral fluency") must be checked
  against Pearson's current Score Guide before M3 uses them.
- Exam timings are not stored yet (blueprint arrives in M4; every rule must cite an official source).

## Known issues and limitations
- AI is mock-only (demo banner shown). Local models arrive in M3.
- Lessons are listed on the dashboard but lesson pages open in M2.
- Streak and "today" use UTC days.
- `make` needs a Unix shell; Windows users use WSL2 or `scripts/setup.ps1` (not tested on Windows/macOS yet).

## M1 implementation (done)
Repo + docs → migrations (schema, RLS, trigger) → content + seed generator → FastAPI (JWT, errors, logging,
rate limit, health, REST, GraphQL with limits + DataLoaders) → mock AI → Next.js (design system, i18n,
landing, auth, onboarding, dashboard, profile) → Docker/Makefile/scripts → tests → CI. Details: docs/HISTORY.md.
