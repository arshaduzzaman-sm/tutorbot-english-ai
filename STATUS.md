# STATUS

**Current milestone:** M2 Learning (branch `m2-learning`, M1 done in PR #1) · **Last updated:** 2026-11-22

## M1 acceptance criteria
- [x] `make setup` then `make start` runs the full app locally with no API keys (tested on Linux; see Known issues)
- [x] Dashboard loads with one GraphQL query; GraphQL permission tests pass
- [x] Register → verification email (local mail viewer) → verify → login → logout → reset password (e2e)
- [x] Protected pages redirect logged-out users; FastAPI rejects requests without a valid JWT (tested)
- [x] Onboarding saves level and target score to `profiles` (API + e2e tests)
- [x] Dashboard shows real DB data and correct empty states for a new user
- [x] RLS tests prove one user cannot read another user's data
- [x] Landing page responsive (375 px), passes axe (WCAG 2.2 AA tags), shows Pearson disclaimer
- [x] Backend, frontend and e2e tests pass in GitHub CI (PR #1, both jobs green on 2026-11-22)

## Test results (2026-11-22, local)
- Backend `pytest -q`: 43 passed (26 unit/security, 17 integration with RLS + GraphQL)
- Frontend `vitest`: 16 passed · `tsc` and `eslint`: clean · `ruff`, `mypy --strict`: clean
- E2E Playwright against the Docker stack (`make setup` + `make start` from clean): 19 passed (desktop + 375 px)
- Memory: whole running stack (Supabase + API + web) uses about 0.6 GB RAM

## Content counts
- Levels: 6 · Lessons: 5 (Level 1) · Question types: 22 · Sample questions: 44 (2 per type)

## M2 plan (one small PR each, into `m2-learning`)
- [x] PR A `m2-lesson-pages`: lesson list + Learn/See/Try/Check player, auto-marking, progress (pytest 48, vitest 17, e2e 20)
- [x] PR B `m2-reading-practice`: 5 reading types, Learn + Practice modes, auto-marking (pytest 55, vitest 18, e2e 21)
- [x] PR C `m2-listening-practice`: 7 auto-marked listening types, audio player, Kokoro script (pytest 57, vitest 20, e2e 22)
- [x] PR D `m2-mistake-review`: mistake notebook + spaced review, new table `review_items` (pytest 59, vitest 21, e2e 23)
- [x] PR E `m2-placement-plan`: 18-item placement test, level + daily plan, tables `placement_tests`, `study_plans` (pytest 63, vitest 22, e2e 24)
- [x] PR F1 `m2-units`: units, end-of-unit tests, unlock rule, tables `units`, `unit_progress` (pytest 65, vitest 23, e2e 25)
- [x] PR F2 `m2-content-import`: `make import` (CSV/JSON), shared content rules, instructions rewritten (pytest 68)
- [ ] PR F3+ more content (Levels 1-3, about 60 lessons, 30+ questions per reading/listening type)

## Next step
1. Owner: merge PR #1 (`m1-foundation` → `main`), then the M2 PRs in order.
2. Agent: continue with PR F3 (content).

## Open questions / items for the owner
- **Legal:** product renamed to TutorBot English AI. Still get advice on descriptive use of "PTE" (docs/LEGAL_NOTES.md).
- **Privacy/terms pages** are templates, marked "to be reviewed by a lawyer".
- **Unverified:** official CEFR-to-PTE score mapping. Pearson's 2025 update page says the CEFR alignment is
  unchanged but gives no table, so the app shows CEFR levels only (no PTE ranges).
- **Unverified:** scoring-criteria names stored on sample questions (e.g. "Oral fluency") must be checked
  against Pearson's current Score Guide before M3 uses them.
- **Practice marking** is our own simple method (share of correct parts; multiple-answer: +1 right, -1 wrong,
  never below 0). It is labelled "not an official PTE score". Practice mode shows a count-up timer, not official timings.
- **Listening audio:** `make audio` (Kokoro) is written but not run here (model download blocked in this
  environment). Without the files, the app uses the browser's speech voice. Summarize Spoken Text waits for M3.
- Exam timings are not stored yet (blueprint arrives in M4; every rule must cite an official source).

## Known issues and limitations
- AI is mock-only (demo banner shown). Local models arrive in M3.
- Streak and "today" use UTC days.
- Placement test covers reading, listening and writing (grammar/words) only; speaking joins in M3.
  Levels 5-6 have 3 items each, so the top of the range is a rough guide.
- Units lock in the UI and for the unit test; the lesson REST endpoints do not check the lock yet.
- Mistake notebook covers practice questions; wrong answers inside lessons are not saved there yet.
- `make` needs a Unix shell; Windows users use WSL2 or `scripts/setup.ps1` (not tested on Windows/macOS yet).

## M1 implementation (done)
Repo + docs → migrations (schema, RLS, trigger) → content + seed generator → FastAPI (JWT, errors, logging,
rate limit, health, REST, GraphQL with limits + DataLoaders) → mock AI → Next.js (design system, i18n,
landing, auth, onboarding, dashboard, profile) → Docker/Makefile/scripts → tests → CI. Details: docs/HISTORY.md.
