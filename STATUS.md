# STATUS

**Current milestone:** M5-M8 done on `m5-m8` (PR 3 of 3): v1.0.0 ready once merged · **Last updated:** 2026-11-22
Earlier milestones: docs/HISTORY.md. M3/M4 acceptance: PR #14.

## M5 acceptance (AI personalisation)
- [x] Recommendations change with real attempt history (API test with seeded users; e2e progress page)
- [x] Adaptive difficulty: weak run → easier questions, strong run → harder (API test)
- [x] Readiness as bands only, weekly check-in, daily plan from recommendations (unit + e2e)
- [x] Tutor adapts to level, stays on topic, refuses score promises, daily limit (API + e2e)
- [ ] Optional in-browser transcription: not built. The browser Web Speech API sends audio to a cloud service in
  most browsers (breaks local-only), and in-browser Whisper needs model files we could not download here.

## M6 acceptance (analytics)
- [x] Charts from real data with data-table alternatives, correct against seeded data (API test + e2e + axe)
- [x] By question type with last-14-days comparison, weekly skill trend, CSV report export

## M7 acceptance (administration)
- [x] Only admin/content_editor reach admin features: every route tested for 401/403; pages return 404
- [x] AI-generated content cannot be published without approval by a different staff member (API test, database
  trigger test with direct SQL, e2e)
- [x] Content review workflow with versions, uploads, learner reports, users and roles, blueprints, usage, calibration

## M8 acceptance (release)
- [x] OWASP Top 10 review (docs/SECURITY_REVIEW.md); CSP added; licence audit (docs/LICENCE_AUDIT.md)
- [x] Secret scan of the full history (`scripts/secret_scan.py`, also in CI): none found
- [x] `make backup` / `make restore` (round trip tested: accounts, progress, content and recordings match)
- [x] README, release notes (docs/releases/v1.0.0.md), licence files
- [ ] Windows and macOS: documented, not tested · [ ] GitHub release `v1.0.0`: after the owner merges to `main`
- [ ] Docker image rebuild not re-run here (this sandbox's proxy certificate is not trusted inside Docker builds)

## Test results (2026-11-22, local)
- Backend `pytest -q`: 121 passed · `ruff`, `ruff format`, `mypy --strict`: clean
- Frontend `vitest`: 30 passed · `tsc`, `eslint`, `next build`: clean · E2E Playwright (desktop + 375 px): 37 passed
- `pnpm audit --prod`, `pip-audit`: no known vulnerabilities · `build_seed.py --check`: up to date

## Content counts
- Lessons: 95 in 21 units (6 levels) · Placement items: 18 · Academy pages: 22 · Blueprints: 6
- Practice questions: 446 · Vocabulary: 1,561 words in 61 sets · Pronunciation: 25 topics, 146 drill items

## Next step
1. Owner: merge PR #1, #12, #13, #14 and PR 3 in order, then `m2-learning` → `main`.
2. Owner (or agent when asked): tag `v1.0.0` on `main` and publish the release with docs/releases/v1.0.0.md.

## Unverified rules (marked `verified: false`; Pearson does not publish these)
- Item counts per task in a full test (full_mock: 72 items) and the order of items inside a section.
- Section clocks we chose: Reading 30 min, Listening 23 min after Summarize Spoken Text, mini/section mock clocks.
- Read Aloud answer time 40 s (our choice) · timed-drill time per item: 120 s reading, 90 s listening (our rule).
- Official CEFR-to-PTE table: none published, so the app shows CEFR levels only.

## Known limitations
- AI is mock-only in our tests (demo banner shown). Local providers are unit-tested for their error path only.
- Pronunciation uses Whisper word confidence as a proxy, not a phoneme model.
- No 10-90 estimates. The calibration tool sets the minimum (30 ratings per type, 60% exact, 80% adjacent); turning
  them on is a separate decision.
- Tutor topic filter is a keyword check; unusual on-topic questions may get the "English and PTE only" reply.
- Admin uploads accept JSON (CSV via `make import`). Uploaded questions live in the database; export them with
  `GET /api/v1/admin/questions/export` and commit them to `content/` to keep them after `make reset`.
- Streak and "today" use UTC days. Recordings have no automatic expiry yet.
- Listening audio: `make audio` (Kokoro) not run here; the browser voice is used without the files.
- Legal: get advice on descriptive use of "PTE" (docs/LEGAL_NOTES.md); privacy/terms pages need a lawyer.
- `make` needs a Unix shell; Windows users use WSL2 or `scripts/setup.ps1`.
