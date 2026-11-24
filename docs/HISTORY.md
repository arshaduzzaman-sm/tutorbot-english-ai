# HISTORY (finished work; not read every session)

## 2026-11-22 · M1 Foundation, session 1
- Environment: Ubuntu 24.04, Node 22, pnpm 10, Python 3.12, Docker 29, Supabase CLI 2.122, 15 GB RAM, no GPU.
- Licence chosen by owner: MIT (code) + CC BY-SA 4.0 (content).
- Checked the 22 task types against pearsonpte.com (2025 update: two new speaking tasks from 7 August 2025; the
  original 20 remain). Recorded in content/question_categories.json and DECISIONS.md.
- Built: schema + RLS migrations, signup trigger, content files and seed generator, FastAPI (JWT via JWKS, errors,
  logs, rate limit, health, REST onboarding/export/delete, GraphQL dashboard with limits and DataLoaders), mock AI
  providers, Next.js app (landing, auth, onboarding, dashboard, profile, legal pages), Docker, Makefile, CI.
- Bug found by e2e in Docker: redirects used the 0.0.0.0 bind address; fixed with `publicOrigin()`.

## M2 Learning (2026-11-22)
PRs into `m2-learning`: lesson pages (#2), reading practice, listening practice + Kokoro script, mistake notebook +
spaced review, placement + study plan, units + unlock rule, content import, Level 1 content, Level 2 units 1-2 (#12),
then `m2-finish`: Level 2 units 3-4, Level 3, 280 more questions, vocabulary and pronunciation tracks, API lesson lock.

### M1 acceptance criteria
- [x] `make setup` then `make start` runs the full app locally with no API keys (tested on Linux; see Known issues)
- [x] Dashboard loads with one GraphQL query; GraphQL permission tests pass
- [x] Register → verification email (local mail viewer) → verify → login → logout → reset password (e2e)
- [x] Protected pages redirect logged-out users; FastAPI rejects requests without a valid JWT (tested)
- [x] Onboarding saves level and target score to `profiles` (API + e2e tests)
- [x] Dashboard shows real DB data and correct empty states for a new user
- [x] RLS tests prove one user cannot read another user's data
- [x] Landing page responsive (375 px), passes axe (WCAG 2.2 AA tags), shows Pearson disclaimer
- [x] Backend, frontend and e2e tests pass in GitHub CI (PR #1, both jobs green on 2026-11-22)

### M1 implementation (done)
Repo + docs → migrations (schema, RLS, trigger) → content + seed generator → FastAPI (JWT, errors, logging,
rate limit, health, REST, GraphQL with limits + DataLoaders) → mock AI → Next.js (design system, i18n,
landing, auth, onboarding, dashboard, profile) → Docker/Makefile/scripts → tests → CI. Details: docs/HISTORY.md.

## M3 Speaking + Writing and M4 Mock exams (2026-11-22, branch `m3-m4`)
Recordings with consent, evaluation jobs + worker, speaking and writing evaluators (signals → bands), local
providers (faster-whisper, LanguageTool, sentence-transformers, Ollama) + mocks, Question-Type Academy (22 pages),
timed drills, 66 speaking/writing questions, blueprints + exam engine (resume, no going back, section clocks,
report), Levels 4-6 (36 lessons, 9 units).

## M5-M8: coach, analytics, admin, release (2026-11-22, branch `m5-m8`)
Coaching (recommendations, adaptive difficulty, readiness bands, weekly check-in, daily plan), tutor chat,
progress analytics with accessible charts and CSV, admin area (review workflow with a database publish guard,
uploads, reports, users and roles, blueprints, usage, calibration), CSP header, secret scan, OWASP review,
licence audit, backup/restore, README and v1.0.0 release notes. Fixed: recordings path inside the Docker image.
