# STATUS

**Current milestone:** M2 Learning done on `m2-finish`; next M3 + M4 (M1 in PR #1) · **Last updated:** 2026-11-22

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

## M2 acceptance criteria
- [x] Diagnostic → level + daily plan (e2e placement)
- [x] Finish a full unit and its end-of-unit test; the next unit opens (e2e units; API also blocks locked lessons)
- [x] Wrong answers go to the mistake notebook and come back in spaced review (e2e review)
- [x] Every reading and listening type answered with auto-marking and explanations (e2e practice; 30 questions per type)
- [x] Progress updates on the dashboard (e2e lessons)
- [x] Levels 1-3 units (59 lessons), vocabulary (1,561 words) and pronunciation (25 topics) tracks, import + audio scripts
- [ ] GitHub CI green on the final M2 PR (owner merges)

## Test results (2026-11-22, local)
- Backend `pytest -q`: 72 passed · `ruff`, `mypy --strict`: clean
- Frontend `vitest`: 24 passed · `tsc` and `eslint`: clean
- E2E Playwright (desktop + 375 px): 27 passed

## Content counts
- Lessons: 59 (Level 1: 19 in 4 units; Level 2: 20 in 4 units; Level 3: 20 in 4 units) · Placement items: 18
- Practice questions: 362 (30 per auto-marked reading/listening type; 2 per speaking/writing type)
- Vocabulary: 1,561 words in 61 sets · Pronunciation: 25 topics, 146 drill items

## Plan from here (owner asked for 3 PRs in total)
- [ ] PR 1 `m2-finish` → `m2-learning`: rest of M2 (this branch; builds on PR #12)
- [ ] PR 2 `m3-m4`: speaking + writing (recording, consent, jobs, local AI + mocks, 22 Question-Type Academy pages,
  timed drills), mock exam engine (blueprint, timers, resume, results), Levels 4-6
- [ ] PR 3 `m5-m8`: AI tutor, adaptive plans, analytics charts, admin + content review, security/licence audit,
  backup/restore, release docs

## Next step
1. Owner: merge PR #1 (`m1-foundation` → `main`), then the M2 PRs in order.
2. Agent: PR 2 (M3 + M4).

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
- Mistake notebook covers practice questions; wrong answers inside lessons are not saved there yet.
- Pronunciation drills are listen-and-choose only; speaking practice with feedback arrives in M3.
- `make` needs a Unix shell; Windows users use WSL2 or `scripts/setup.ps1` (not tested on Windows/macOS yet).

## M1 implementation (done)
Repo + docs → migrations (schema, RLS, trigger) → content + seed generator → FastAPI (JWT, errors, logging,
rate limit, health, REST, GraphQL with limits + DataLoaders) → mock AI → Next.js (design system, i18n,
landing, auth, onboarding, dashboard, profile) → Docker/Makefile/scripts → tests → CI. Details: docs/HISTORY.md.
