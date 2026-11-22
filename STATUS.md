# STATUS

**Current milestone:** M3 + M4 done on `m3-m4` (PR 2 of 3); next PR 3: M5-M8 · **Last updated:** 2026-11-22
M1 criteria and history: docs/HISTORY.md.

## M2 acceptance criteria
- [x] Diagnostic → level + daily plan; full unit + end-of-unit test opens the next unit; mistakes come back in review
- [x] Every reading and listening type auto-marked with explanations; progress on the dashboard (e2e)
- [ ] GitHub CI green on the final M2 PR (owner merges)

## M3 acceptance criteria (speaking + writing)
- [x] Microphone recording only after consent; consent can be turned off on the profile page (e2e)
- [x] Recording → background job → evaluation with criteria, bands, errors and feedback (e2e with mocks)
- [x] Every speaking and writing type evaluated; scores from signals, LLM writes text only (API tests)
- [x] Results show bands only + "Practice estimate. Not an official PTE score." (e2e checks no "/90")
- [x] Recordings in export, deleted with the account, never in git (API tests)
- [x] Local providers exist and fail with a clear message when not installed (unit tests)
- [ ] Local models run on a real computer (blocked here: downloads not allowed; see docs/AI_MODELS.md)

## M4 acceptance criteria (mock exams + Academy)
- [x] 22 Question-Type Academy pages: what, scoring traits with source, strategy, strong/medium/weak examples (e2e)
- [x] Timed drills per type (e2e) · full, section and mini mocks from blueprints
- [x] Exam: resume after reload, no going back, section clock auto-submits, report by section/skill/type (e2e + API)
- [x] Levels 4-6: 36 lessons in 9 units with end-of-unit tests (API test: every level has lessons and units)

## Test results (2026-11-22, local)
- Backend `pytest -q`: 92 passed · `ruff`, `mypy --strict`: clean
- Frontend `vitest`: 26 passed · `tsc`, `eslint`, `next build`: clean
- E2E Playwright (desktop + 375 px): 33 passed · `build_seed.py --check`: up to date

## Content counts
- Lessons: 95 (Levels 1-3: 59 in 12 units; Levels 4-6: 36 in 9 units) · Placement items: 18
- Practice questions: 446 (30 per reading/listening type; 66 speaking/writing) · Academy pages: 22 · Blueprints: 6
- Vocabulary: 1,561 words in 61 sets · Pronunciation: 25 topics, 146 drill items

## Plan (owner asked for 3 PRs in total)
- [x] PR 1 `m2-finish` → `m2-learning` (#13)
- [x] PR 2 `m3-m4` → `m2-finish`: speaking, writing, mock exams, Levels 4-6
- [ ] PR 3 `m5-m8`: AI tutor, adaptive plans, analytics charts, admin + content review, security/licence audit,
  backup/restore, release docs

## Next step
1. Owner: merge PR #1, then #12, #13 and PR 2 in order.
2. Agent: PR 3 (M5-M8).

## Unverified rules (marked `verified: false`; Pearson does not publish these)
- Item counts per task in a full test (full_mock uses 72 items) and the order of items inside a section.
- Section clocks we chose: Reading 30 min, Listening 23 min after Summarize Spoken Text, mini/section mock clocks.
- Read Aloud answer time 40 s (our choice; preparation 30-40 s is published).
- Timed drill time per item: 120 s reading, 90 s listening (our own drill rule, not exam timing).
- Official CEFR-to-PTE score table: none published, so the app shows CEFR levels only.
- Per-task timings in `content/blueprints/task_rules.json` are checked against pearsonpte.com (verified).

## Open questions / items for the owner
- **Legal:** get advice on descriptive use of "PTE" (docs/LEGAL_NOTES.md). Privacy/terms pages need a lawyer.
- **Practice marking** for reading/listening is our own simple method, labelled "not an official PTE score".
- **Pronunciation** uses Whisper word confidence as a proxy until a phoneme model is checked (DECISIONS).
- **Listening audio:** `make audio` (Kokoro) is written but not run here. Without files the browser voice is used.

## Known issues and limitations
- AI runs as mocks here (demo banner shown). Local providers are untested on real models.
- Streak and "today" use UTC days. Placement covers reading, listening and writing only.
- Mistake notebook covers practice questions; wrong answers inside lessons are not saved there yet.
- Exam reports show bands per criterion; no overall 10-90 score until calibration (M7).
- `make` needs a Unix shell; Windows users use WSL2 or `scripts/setup.ps1` (not tested on Windows/macOS yet).
