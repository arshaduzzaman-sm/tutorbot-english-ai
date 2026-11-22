# Decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-11-22 | Product renamed to TutorBot English AI, repo `tutorbot-english-ai` | Owner decision, to avoid using Pearson's "PTE" trademark in the name. PTE is still named descriptively, with the disclaimer. |
| 2026-11-22 | Licence: MIT for code, CC BY-SA 4.0 for original content | Chosen by the owner. |
| 2026-11-22 | Next.js 16 (current stable) with `src/proxy.ts` | Spec says Next.js App Router; v16 renames middleware to proxy. |
| 2026-11-22 | shadcn/ui-style components written in-repo (`components/ui`, `components.json` present) | Same pattern shadcn generates; avoids extra Radix deps in M1. More can be added with the shadcn CLI. |
| 2026-11-22 | `@urql/core` used in server components (not React hooks) | Dashboard is server-rendered in one GraphQL request; no client loading flash. urql hooks can be added for client views later. |
| 2026-11-22 | API runs user queries as `authenticated` role with JWT claims | Makes RLS protect API traffic, not only direct Supabase access. |
| 2026-11-22 | JWT verified with JWKS (ES256) + optional HS256 secret | Local Supabase CLI 2.x signs user tokens with ES256. HS256 only if `JWT_SECRET` is set. |
| 2026-11-22 | Auth emails link to `/auth/confirm?token_hash=` (custom templates) | Works across browsers/devices, unlike the PKCE code flow. |
| 2026-11-22 | Email confirmation enabled; minimum password length 8 | Spec requires verification; stronger than default 6. |
| 2026-11-22 | Background worker deferred to M3 | M1 has no async jobs. Procrastinate (Postgres queue) planned. |
| 2026-11-22 | 22 task types, per pearsonpte.com 2025 update (checked 2026-11-22) | Matches spec list. Pearson names Reading FIB as "Fill in the Blanks (Dropdown)" and "(Drag and Drop)", Listening FIB as "(Type In)"; we keep spec names and note Pearson's. |
| 2026-11-22 | CEFR shown without PTE score ranges | No official CEFR→PTE table found on the checked official pages (SPEC 5A.1 rule). |
| 2026-11-22 | Streak/daily minutes in UTC | Simple and deterministic for M1; per-user time zone later. |
| 2026-11-22 | Unused Supabase services excluded at start (studio, realtime, etc.) | Saves memory for the 8 GB minimum tier. |
| 2026-11-22 | Listening audio as static files (`make audio`, Kokoro) with browser speech voice fallback | SPEC 6 says Supabase Storage; static git-ignored files are simpler locally. The audio script never goes in page HTML: it is fetched only on Play or for the Learn-mode transcript. Revisit when content moves to Storage. |
| 2026-11-22 | Vocabulary list chosen by word frequency (wordfreq data, CC BY-SA 4.0); meanings and examples written by us | Frequency-based core words as SPEC 5A.1 asks; licence matches our content licence. Names, slang and offensive words removed by hand. |
| 2026-11-22 | Flashcards reuse the mistake-notebook boxes (1, 3, 7, 14 days) in a separate table `vocabulary_reviews` | One spaced-review rule for the whole app; `review_items` stays tied to questions. |
| 2026-11-22 | Pronunciation drills are listen-and-choose (auto-marked) until M3 | Recording + pronunciation analyser are M3 work. Symbols follow common British dictionary style. |
| 2026-11-22 | E2E runs the API with `RATE_LIMIT_PER_MINUTE=1000` | All test learners share the web server's IP; the normal limit (120/min per IP) stays for real use. |
| 2026-11-22 | Pronunciation uses Whisper word confidence as a proxy, not a phoneme model | No wav2vec2 phoneme model could be downloaded or licence-checked here. The proxy is labelled in the result; replace when a model is verified. |
| 2026-11-22 | Evaluation jobs use a Postgres table claimed with `for update skip locked`; worker runs in the API process or `python -m app.workers` | No extra queue service (local-only, 8 GB tier). Stale jobs are re-queued. |
| 2026-11-22 | Recordings are files under `recordings/<user>/` (git-ignored), not Supabase Storage | Simpler locally; deleted with the account and included in the export list. |
| 2026-11-22 | Mock exam state is written only by the API (service role); students can only read their own sessions | Stops a student from changing answers, timers or position through the database. |
| 2026-11-22 | Exam blueprints keep unverified counts and clocks with `verified: false` | Pearson publishes per-task timings but not exact item counts per test; the report says "practice estimate". |
| 2026-11-22 | Coaching rules are plain, tested functions (services/coach.py), not an LLM | Recommendations must follow real history and be explainable (SPEC 6.1). |
| 2026-11-22 | Tutor topic filter is a keyword check before the LLM; score promises get a fixed reply | Off-topic and score questions never reach the LLM and do not use the daily limit. |
| 2026-11-22 | Charts are small hand-written SVG components with a data table each | No chart library to download or audit; accessibility comes first (M6). |
| 2026-11-22 | Publishing is guarded by a database trigger (approval of the current version; AI content needs a different reviewer) | Holds for every path into the database, not only the API. Edits bump the version. |
| 2026-11-22 | Role changes and the audit log use the service role after `require_role("admin")` | RLS deliberately blocks learners and editors from these tables. |
| 2026-11-22 | Calibration uses only the admin's own sample answers | Learners' answers are never shown to staff (privacy by default). |
| 2026-11-22 | Content rules live in apps/api/app/services/content_rules.py; scripts load that file | One copy of the checks for the seed builder, the import script and admin uploads. |
| 2026-11-22 | Secret scan is our own script (scripts/secret_scan.py) run in CI | No third-party binary or action; it scans every commit on every branch. |
| 2026-11-22 | Backups are a data-only pg_dump from the database container plus a tar of recordings | Version-matched pg_dump; restore applies migrations first, then loads the data with triggers off. |
| 2026-11-22 | No in-browser transcription in v1.0.0 | The Web Speech API sends audio to a cloud service in most browsers; local-only wins. |
| — | Numeric 10-90 estimates: minimum set by the M7 calibration tool (30 ratings per type, 60% exact, 80% within one band) | SPEC 7.3. Still not enabled; needs a separate decision. |
