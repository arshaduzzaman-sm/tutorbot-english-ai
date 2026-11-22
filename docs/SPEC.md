# PART A: PERMANENT PROJECT RULES

> **Name change (2026-11-22):** the owner renamed the product from "PTE Master AI" to **TutorBot English AI**
> (repository `tutorbot-english-ai`) so the name does not use Pearson's "PTE" trademark. The app still
> describes PTE Academic preparation and shows the Pearson disclaimer. See docs/DECISIONS.md.

*(The AI must save this whole part as `docs/SPEC.md`, then write a short `CLAUDE.md` from it as described in Section 3.3.)*

## 1. ROLE

Work as a senior full-stack team covering product, architecture, UI/UX, frontend, backend, AI/ML, database, QA, DevOps and security. Build a real, working, tested application. Do not build a demo, a static prototype or a landing-page-only site.

## 2. PRODUCT

**Name:** TutorBot English AI
**Repository name:** `tutorbot-english-ai`
**Tagline:** Learn English. Master PTE. Achieve Your Target.
**Type:** A free, open-source, AI-powered English-learning and PTE Academic preparation app that **runs entirely on the learner's own computer**.
**Distribution:** A public GitHub repository. There is **no online deployment, no hosted server and no cloud service**. Anyone can download the code and run it locally with Docker. All data (accounts, recordings, progress) stays on the computer where it runs.

**Homepage message (use in the hero section, word for word):**
> Free practice and AI feedback to help you improve your English and prepare for PTE Academic. Your results depend on your study and practice.

### 2.1 Who it is for and what it must achieve
Learners at every level, from people who do not yet know the English alphabet to advanced candidates targeting PTE 79–90.

**The mission has two equal parts:**
1. **Real English mastery.** Take any learner step by step from zero English (CEFR Pre-A1) to advanced academic English (C1/C2): speaking, listening, reading, writing, grammar, vocabulary and pronunciation.
2. **Complete PTE Academic readiness.** Teach and train every one of the 22 current PTE Academic question types, with strategies, unlimited original practice and realistic full mock exams. The learner should walk into the real test already familiar with every task, timer and rule.

The aim is to give every learner **the best possible chance** of reaching their target score, including 85–90. The platform must never promise that anyone will pass. Results depend on each learner's study and practice.

### 2.2 Non-negotiable product rules
- The platform is **free**. There are no paywalls, subscriptions or mandatory premium tiers.
- **Never guarantee** any exam score.
- **Never present an estimate as an official Pearson score.** Every estimate is labelled "Practice estimate: not an official PTE score".
- **Trademark disclaimer** in the footer, terms page and About page: "TutorBot English AI is an independent learning platform. It is not affiliated with, endorsed by, or sponsored by Pearson. PTE and PTE Academic are trademarks of Pearson." Add a `docs/LEGAL_NOTES.md` file reminding the owner to get legal advice on using "PTE" in the product name before public launch.
- **Never copy** Pearson's or anyone else's copyrighted exam questions. All content is original or properly licensed.
- **Minimise running costs.** Prefer free, open-source and locally run AI (see Section 6).

## 3. TECHNOLOGY STACK (DECIDED, DO NOT CHANGE WITHOUT WRITING A REASON IN `docs/DECISIONS.md`)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript (strict), React, Tailwind CSS, shadcn/ui, Lucide icons, next-intl (i18n), Recharts (charts), dnd-kit (drag and drop) |
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 (async). **GraphQL** (Strawberry, mounted in FastAPI) for reading data; **REST** (OpenAPI) for actions: auth helpers, file uploads, starting evaluations, job status |
| API client (frontend) | urql (GraphQL) + GraphQL Code Generator for typed queries; a typed REST client generated from OpenAPI |
| Background jobs | A Postgres-backed job queue (for example `procrastinate`) for AI evaluations, so no extra paid service is needed |
| Database | PostgreSQL via **local** Supabase (Supabase CLI, runs in Docker; no Supabase cloud account needed) |
| Auth | Supabase Auth (local) |
| File storage | Supabase Storage (local, private buckets) |
| Running the app | Supabase CLI (`supabase start`, includes a local email viewer for verification emails) + Docker Compose for web, API, worker and AI services, all started by **one command** (Section 3.4) |
| Tests | Pytest + httpx (backend), Vitest + React Testing Library (frontend), Playwright (end-to-end) |
| CI | GitHub Actions: lint, type-check, unit tests, integration tests, e2e tests |
| Deployment | **None.** Local only. Shared as a public GitHub repo with releases (version tags) |

### 3.1 Architecture decisions (fixed)
1. **One source of truth for the schema:** SQL migrations in `supabase/migrations/`. SQLAlchemy models map to these tables. **Do not use Alembic.**
2. **Users:** Supabase owns `auth.users`. The app uses a `public.profiles` table (1:1 with `auth.users.id`), created automatically by a database trigger on signup. Do not create a separate `users` table.
3. **Auth flow:** The frontend uses `@supabase/ssr` for sign-up, login, email verification, password reset and sessions. Every FastAPI request must include the Supabase access token, and FastAPI verifies the JWT (signature, expiry, audience) on every protected endpoint.
4. **Data access:** All application data goes **through FastAPI**. Reads use the GraphQL endpoint `/graphql`, so each screen asks for exactly the fields it needs in one request (for example the dashboard loads profile, progress, streak and recent attempts in a single query). Writes and actions use REST. The frontend talks to Supabase directly only for auth and for signed upload/download URLs. Row-Level Security is still enabled on every user-data table as a second layer of protection.
   - GraphQL rules: authenticate every request with the same JWT check; use DataLoaders to avoid N+1 database queries; set limits on query depth and complexity; turn off introspection outside development mode; write tests for every resolver, including permission tests.
5. **Roles:** `student`, `content_editor`, `admin`, stored in a `user_roles` table and checked in FastAPI dependencies.
6. **Configuration:** All secrets come from environment variables. Provide `.env.example` files. Never commit secrets.

### 3.2 Local-only and public-repository rules
- Everything must run on one computer with Docker. **No cloud accounts, API keys or paid services are required.**
- **Never commit** secrets, `.env` files, user data, recordings or AI model weights. Model weights are downloaded by a script (`scripts/download-models.sh`) into a folder listed in `.gitignore`.
- Add `LICENSE` (ask the owner to choose; suggest MIT or Apache-2.0 for code and CC BY-SA 4.0 for original learning content), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` and issue templates.
- The README must clearly say: what the app is, the Pearson disclaimer, hardware needs (Section 6.4), the one-command setup, how to reset or delete all local data, and how to update to a new version.
- Because data stays on the user's computer, keep consent and deletion features, but explain in the README and privacy page that data is stored only locally.
- Bind all services to `localhost` by default so the app is not exposed to the local network unless the user deliberately changes it.

### 3.3 Token-saving rules for the AI coding agent
Every file the agent reads costs tokens, every session. Keep the context small:
1. **`CLAUDE.md` must be short (under 150 lines).** It contains only the critical rules, the tech decisions, the folder map and the commands. It points to sections of `docs/SPEC.md` for details. Do **not** read the full `docs/SPEC.md` every session; open only the sections needed for the current task.
2. **`STATUS.md` must stay short (under 100 lines):** current milestone, checklist, next step, open questions. Move finished history to `docs/HISTORY.md`, which is not read unless needed.
3. **`docs/CODEMAP.md`:** one line per important file or folder explaining what it does. Update it when files are added. Use it to find code instead of scanning the whole repository.
4. Search before reading: use `grep`/search to find the exact lines needed instead of opening whole files. Never open lock files, build output, `node_modules`, model files or large seed files.
5. Run tests and builds in quiet mode and read only the failures (for example `pytest -q`, `pnpm test --silent`). Do not paste long logs.
6. Work in **small tasks:** one feature (or one part of a milestone) per session, then commit and update `STATUS.md`.
7. Do not rewrite whole files to change a few lines; make targeted edits.
8. Generate repetitive code and content with scripts (for example question JSON from a template) instead of writing it out token by token.

**App-side AI (free local models):** local Ollama models cost no money, but long prompts still make the app slow. Keep prompts short, send only the data needed, cap output length, cache results for identical inputs, and calculate scores without the LLM (Section 6.1).

### 3.4 One-command setup
Provide `scripts/setup.sh` (macOS/Linux) and `scripts/setup.ps1` (Windows) plus a `Makefile` with:
- `make setup`: check Docker, Node, pnpm and the Supabase CLI; create `.env` files from the examples; download AI models for the detected hardware tier; start Supabase; run migrations and seed data.
- `make start` / `make stop`: start or stop everything.
- `make test`: run all tests.
- `make reset`: delete all local data and start fresh (with a confirmation prompt).
- `make update`: pull the latest version and apply new migrations.
- `make mock`: run with mock AI only (for low-power computers).

## 4. REPOSITORY STRUCTURE

```
tutorbot-english-ai/
├── CLAUDE.md                 # Short rules file read every session (<150 lines)
├── STATUS.md                 # Short current-status file (<100 lines)
├── README.md                 # What it is, setup and run instructions
├── LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
├── Makefile                  # setup, start, stop, test, reset, update, mock
├── docker-compose.yml        # web, api, worker, ai services (LanguageTool, Ollama)
├── .github/workflows/ci.yml
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # FastAPI backend + worker
│       └── app/
│           ├── api/          # Routers
│           ├── core/         # Config, security, logging
│           ├── db/           # SQLAlchemy models, session
│           ├── services/     # Business logic
│           ├── ai/           # AI provider interfaces + implementations
│           │   ├── interfaces/
│           │   ├── providers/   # local, browser-assisted, mock
│           │   └── evaluation/  # Task-specific evaluators
│           └── workers/      # Background jobs
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── content/                  # Original lessons and questions (JSON/Markdown), versioned
│   ├── lessons/
│   ├── questions/
│   └── blueprints/           # Versioned mock-exam blueprints
├── scripts/                  # setup, model download, content import, audio generation, calibration
├── models/                   # Downloaded AI models (git-ignored)
├── tests/e2e/                # Playwright
└── docs/
    ├── SPEC.md               # Full specification (this prompt's Part A)
    ├── CODEMAP.md            # One line per important file
    ├── HISTORY.md            # Finished work log
    ├── ARCHITECTURE.md
    ├── DECISIONS.md
    ├── AI_MODELS.md          # Models, licences, hardware needs
    ├── API.md
    ├── CONTENT_GUIDE.md
    ├── PRIVACY.md
    └── LEGAL_NOTES.md
```

## 5. APPLICATION MODULES

### Module 1: Landing page
Logo, hero, "Start Learning" button, login/register, platform introduction, the four skills (Speaking, Writing, Reading, Listening), how the AI helps, beginner-to-advanced learning paths, practice features, FAQ, footer with the Pearson disclaimer, privacy and terms links.

### Module 2: Authentication
Registration (with age confirmation: **16+ only**), email verification, login, logout, password recovery, protected routes, profile page, secure sessions, account deletion (deletes the profile, recordings and attempts), and data export (JSON download).

### Module 3: Student dashboard
Welcome message, learning level, target score, overall and per-skill progress, daily goals, recent practice, recommended lessons, weak areas, study streak, mock exam history. **Every value comes from the database.** Show friendly empty states for new users; never show fake numbers.

### Module 4: English Foundation Academy
Lessons: alphabet and pronunciation, basic vocabulary, parts of speech, nouns, pronouns, verbs, adjectives, adverbs, tenses, sentence construction, articles, prepositions, conjunctions, grammar, punctuation, reading comprehension, listening comprehension, speaking confidence, academic vocabulary, essay construction.

Each lesson has: a simple explanation, examples, practice exercises, correct answers, detailed explanations and progress tracking. Use beginner-friendly English (short sentences, common words). The data model must support optional native-language explanations later (Section 9.3).

### Module 5: Speaking practice
All PTE Academic speaking tasks: Read Aloud, Repeat Sentence, Describe Image, Retell Lecture, Answer Short Question, Summarize Group Discussion, Respond to a Situation.

Features: microphone permission and consent screen, recording, playback, recording timer, instructions, transcription, content/pronunciation/fluency/vocabulary feedback, improvement tips and practice history.

### Module 6: Writing practice
Summarize Written Text and Write Essay. Features: editor, live word counter, countdown timer, grammar and spelling checks, vocabulary analysis, sentence-structure feedback, content relevance, coherence and organisation, improvement suggestions, comparison with previous attempts, and a detailed explanation for each error.

### Module 7: Reading practice
Reading & Writing: Fill in the Blanks; Multiple Choice, Multiple Answers; Reorder Paragraphs (drag and drop, keyboard accessible); Reading: Fill in the Blanks; Multiple Choice, Single Answer. Features: timer, answer selection, submit, correct answer, explanation, performance history.

### Module 8: Listening practice
Summarize Spoken Text; Multiple Choice, Multiple Answers; Fill in the Blanks; Highlight Correct Summary; Multiple Choice, Single Answer; Select Missing Word; Highlight Incorrect Words; Write From Dictation. Features: audio player, replay limits (unlimited in Learning mode, exam rules in Exam mode), transcript in Learning mode only, answer checking, explanations, accuracy tracking.

### Module 9: Full mock examination
Timed exam, official section order, question navigation, recording, playback where allowed, auto-submit on timeout, countdown, progress bar, no going back in Exam mode, final report.

**Exam blueprint:** Store as versioned JSON in `content/blueprints/` (for example `pte-academic-2025-08.json`). Every timing, question count and rule must come from Pearson's **official published** test format and score guide. Record the source URL and the date checked in the blueprint file. **If a rule cannot be verified from an official source, do not invent it.** Mark it `"verified": false` and list it in `STATUS.md` for the owner to check.

### Module 10: AI tutor
A chat tutor that explains grammar and vocabulary, corrects sentences, explains PTE question types, gives speaking tips, helps improve essays, recommends practice and explains mistakes simply. It adapts to the learner's level (from the profile). It stays on the topic of English and PTE, refuses unrelated requests politely, and is rate limited.

### Module 11: Performance analytics
Skill progress, accuracy, learning time, question-type performance, weak areas, trends, mock exam results and recommendations, shown with interactive charts. Unvalidated predictions are never shown as official scores.

### Module 12: Administration
Role-based admin area: manage users, create/edit/delete/version questions, manage lessons, upload audio and images, manage exam blueprints, review reported content, approve AI-generated content, monitor usage and AI-job health, view platform analytics, and run calibration reports (Section 7.3).

## 5A. THE MASTERY SYSTEM (CORE OF THE PRODUCT)

This section explains how the modules above work together so a learner can go from zero English to exam-ready.

### 5A.1 English curriculum from zero to advanced (CEFR-aligned)

| Platform level | CEFR | What the learner can do at the end | Rough PTE range (practice guide only) |
|---|---|---|---|
| 1. Beginner English | Pre-A1 → A1 | Alphabet, sounds, numbers, 500 common words, simple present, introduce yourself | — |
| 2. Elementary English | A2 | 1,500 words, past/future, simple paragraphs, short conversations, basic listening | — |
| 3. Intermediate English | B1 | 3,000 words, all main tenses, linking words, opinion paragraphs, everyday lectures | about 30–42 |
| 4. PTE Preparation | B2 | Academic vocabulary, complex sentences, essays, note-taking, all 22 task types | about 43–58 |
| 5. Advanced PTE Preparation | C1 | Precise academic writing, natural fluency, fast reading, detailed listening | about 59–75 |
| 6. PTE 85–90 Target Training | C1+/C2 | Consistency under time pressure, error elimination, full-exam stamina | about 76–90 |

- The PTE ranges are **approximate guides only**. Before publishing them, the AI must check Pearson's official CEFR-to-PTE mapping, replace these numbers with the official ones, and cite the source. If it cannot verify them, show CEFR levels only.
- Each level is divided into **units**. Each unit contains lessons, a vocabulary set, a pronunciation drill, skill practice and an **end-of-unit test**. A learner unlocks the next unit by scoring at least 80% (they may skip ahead by passing a placement test).
- Every lesson follows: **Learn** (simple explanation) → **See** (examples, audio) → **Try** (guided practice with hints) → **Check** (exercise with instant feedback) → **Review** (spaced repetition later).
- Pronunciation track: all English sounds (vowels, consonants, word stress, sentence stress, linking, intonation), with listen-and-repeat drills checked by the pronunciation analyser.
- Vocabulary track: frequency-based core words, then academic vocabulary, with example sentences, audio, collocations and **spaced-repetition** flashcards.
- Grammar track: every grammar point from basic to advanced, each with a self-check quiz.
- Skills track: graded reading passages and listening clips that get longer and faster as the level rises.

### 5A.2 Complete PTE Academic question-type coverage (all 22 types)

Each question type gets its own **Question-Type Academy** page containing:
1. What the task is, which skills it tests, and its timings (from the verified blueprint only).
2. How it is scored (using only Pearson's officially published criteria, with citations).
3. A step-by-step strategy in simple English.
4. Worked examples: a strong answer, a medium answer and a weak answer, each with explanations.
5. Common mistakes.
6. **Practice in four modes** (see 5A.3).
7. A personal performance history for that type.

| Section | Question types |
|---|---|
| Speaking & Writing | Read Aloud · Repeat Sentence · Describe Image · Retell Lecture · Answer Short Question · Summarize Group Discussion · Respond to a Situation · Summarize Written Text · Write Essay |
| Reading | Reading & Writing: Fill in the Blanks · Multiple Choice, Multiple Answers · Reorder Paragraphs · Reading: Fill in the Blanks · Multiple Choice, Single Answer |
| Listening | Summarize Spoken Text · Multiple Choice, Multiple Answers · Fill in the Blanks · Highlight Correct Summary · Multiple Choice, Single Answer · Select Missing Word · Highlight Incorrect Words · Write From Dictation |

Before building, check this list against Pearson's official current test format page. If Pearson has added, removed or changed any task, follow the official source and record the change in `docs/DECISIONS.md`.

**Teach real skills, not memorised templates.** Pearson uses human and AI double-marking for content on several question types, so memorised template answers are risky. Strategies should show learners how to build their own answers, and the evaluator should flag responses that look templated or off-topic.

### 5A.3 Four practice modes
1. **Learn mode:** no timer, hints, transcript visible, unlimited replays, instant explanations.
2. **Practice mode:** real timers, feedback straight after each question.
3. **Timed drill:** a set of 5–20 questions of one type under exam timing, feedback at the end.
4. **Exam mode:** the exact real-test rules from the blueprint, no hints, no going back, results only at the end.

### 5A.4 Realistic exam simulation
- Full mock exams follow the verified blueprint: same section order, question counts, timers, recording beeps and countdowns, auto-start/auto-stop recording rules, audio play rules and navigation rules.
- Include the pre-test steps learners will meet: microphone check, headset/volume check and a short introduction.
- **Look and feel:** a calm, distraction-free test screen in a similar style to computer-based tests (timer top right, question counter, Next button). **Do not copy Pearson's logo, branding, exact screen design or proprietary interface.**
- Also offer **section tests** (Speaking & Writing only, Reading only, Listening only) and **mini mocks** (about 30 minutes) for busy learners.
- After each mock: a full report by skill, by question type and by criterion, the questions with the most lost points, a comparison with previous mocks, and an updated study plan.

### 5A.5 Making learners improve (the learning loop)
- **Mistake notebook:** every wrong answer and every flagged error is saved automatically. Learners can review and retry them later.
- **Spaced repetition:** vocabulary, grammar points and past mistakes come back at increasing intervals.
- **Adaptive difficulty:** questions get harder when the learner does well and easier when they struggle, per question type.
- **Daily plan:** a 15-, 30-, 60- or 120-minute daily plan, chosen by the learner, built from their weaknesses and exam date.
- **Weekly check-in:** a short progress test each week, with a summary of what improved and what to focus on next.
- **Readiness indicator:** a "practice readiness" level per skill (Not ready / Getting close / Ready to try a full mock / Consistently strong). It is always labelled as a practice estimate, and it reminds learners to take an official Pearson scored practice test before booking the real exam.
- **Motivation:** study streaks, goals and badges. Encouraging, simple language. No shaming.

## 6. FREE AND LOCAL AI ARCHITECTURE

### 6.1 Principles
1. **Every AI capability sits behind an interface** in `apps/api/app/ai/interfaces/`: `SpeechToText`, `PronunciationAnalyzer`, `FluencyAnalyzer`, `TextToSpeech`, `GrammarChecker`, `Embedder`, `LLM`.
2. Each interface has a **local** (default) implementation and a **mock** implementation. Do not add cloud providers; the project is local only.
3. **Mock providers** return deterministic fake results, are clearly labelled `provider: "mock"` in every response, and show a visible "Demo mode: AI not connected" banner in the UI. Tests and CI use the mocks. The app must run end to end with **no API keys at all**.
4. **Scores come from measurable signals; the LLM writes the explanations.** Word accuracy, pauses, speech rate, grammar error counts, word counts and similarity are calculated deterministically. The LLM turns those numbers into friendly feedback. It never invents scores. This is cheaper, faster, reproducible and testable.
5. Provider choice is set by environment variables (for example `STT_PROVIDER=local|mock`).
6. Every evaluation is an **async background job**, so the UI shows "Evaluating…" and then the result.

### 6.2 Default free components (check the current version and licence of each before installing, and record it in `docs/AI_MODELS.md`)

| Capability | Default (free, local) | Notes |
|---|---|---|
| Speech-to-text | **faster-whisper** running a Whisper model (start with `small` or `large-v3-turbo` depending on hardware), with **word-level timestamps** | Whisper tends to "clean up" hesitations, so do not rely on it alone for fluency. Use timestamps plus voice-activity detection. |
| Pause and voice detection | **Silero VAD** | Measures pauses, silence and speech segments |
| Read Aloud / Repeat Sentence accuracy | Align the transcript to the reference text (word-level diff) | Gives word accuracy, omissions, insertions and substitutions |
| Pronunciation | A **wav2vec2 phoneme-recognition model** (CTC) compared with the expected phonemes, using a goodness-of-pronunciation-style score per word | Highlight words that were likely mispronounced. Phonemiser tools such as espeak-ng are GPL, so run them as a separate process/container and note the licence. |
| Fluency | Calculated from timestamps: speech rate, pause count and length, filler words ("um", "uh"), repetitions and false starts | Deterministic and unit-tested |
| Grammar and spelling | **LanguageTool** self-hosted server (Docker) | Free, no API key, gives error positions and explanations |
| Vocabulary level | **wordfreq** (word frequency) plus an openly licensed academic word list (check the licence) | Lexical range, repetition, academic words |
| Content relevance | **sentence-transformers** embedding model (for example `all-MiniLM-L6-v2`) comparing the response with the question's key points | Each question stores its key points |
| Feedback text and AI tutor | **Ollama** running a small, permissively licensed (Apache-2.0 or similar) instruction model. Choose the best current option that fits about 8–16 GB of RAM (for example a recent Qwen model of about 4B–8B). | Model name set by `LLM_MODEL` in env. Ask for structured JSON output and validate it with Pydantic. |
| Text-to-speech | **Kokoro-82M** (Apache-2.0, runs on CPU) | Used **offline in content creation** to pre-generate all listening and speaking prompt audio, stored in Supabase Storage. Learners never trigger TTS live, so the running cost is zero. Use several voices and accents, and different voices for each speaker in Summarize Group Discussion. Piper is an alternative but is now GPL-3.0, so check licence obligations. |

### 6.3 Optional "zero server cost" mode (Milestone 5 or later)
Offer an optional **in-browser transcription** mode using Whisper via `transformers.js` (WebGPU/WASM) on capable devices. The audio is processed on the learner's own device and only the transcript and timings are sent to the server. Fall back to server transcription on weak devices. This helps on computers that are too slow to run Whisper in Docker.

### 6.4 Hardware tiers (document in README)
- **Minimum (CPU only, 8 GB RAM):** Whisper `small`, a small LLM of about 3–4B, everything else unchanged. Slower evaluations.
- **Recommended (16 GB RAM, optional GPU):** Whisper `large-v3-turbo`, LLM of about 7–8B.
- **Developer without a powerful PC:** run everything with mock providers.

### 6.5 Cost controls
Per-user daily limits on AI evaluations and tutor messages (configurable), caching of repeated evaluations, a maximum recording length per task, audio compression before upload (Opus/WebM), and a job queue so the server is never overloaded.

## 7. EVALUATION ENGINE

### 7.1 Pipeline (separate, testable components)
1. Audio processing (format check, normalisation, length limits)
2. Transcription
3. Text analysis
4. Pronunciation analysis
5. Fluency analysis
6. Task-specific evaluation
7. Feedback generation (LLM)
8. Storage of results

### 7.2 Structured result (every evaluation returns this shape, validated by Pydantic)
```json
{
  "task_type": "read_aloud",
  "criteria": [
    { "name": "content", "band": "developing", "signals": {}, "explanation": "" }
  ],
  "errors": [{ "type": "", "position": null, "text": "", "correction": "", "explanation": "" }],
  "strengths": [],
  "weaknesses": [],
  "recommendations": [],
  "confidence": 0.0,
  "provider": "local|mock",
  "evaluation_model_version": "eval-2026.1",
  "estimated_score": null,
  "disclaimer": "Practice estimate. Not an official PTE score."
}
```

### 7.3 Score display rule
- **Until calibration data exists, do not show 10–90 score estimates.** Show criterion **bands** only: *Needs work / Developing / Good / Strong*, each with an explanation.
- Build a **calibration tool** (admin, Milestone 7): admins upload human-rated sample responses. The system compares its results with the human ratings and reports agreement per task type.
- A numeric estimate may be enabled **per task type** only after it reaches a documented agreement threshold (configurable, recorded in `docs/DECISIONS.md`), and it is still always labelled as a practice estimate.
- Never invent official PTE scoring rules. Use only Pearson's published scoring criteria names and descriptions, cited in `docs/`.

## 8. LEARNING PATH SYSTEM

Six levels:
1. Beginner English
2. Elementary English
3. Intermediate English
4. PTE Preparation
5. Advanced PTE Preparation
6. PTE 85–90 Target Training

Onboarding after registration: (1) ask the current English level, (2) ask the target score and exam date (optional), (3) run a short diagnostic test of about 15 minutes covering all four skills, (4) identify weaknesses, (5) generate a personalised study plan, (6) recommend a starting level. Learners can change their goals and redo the diagnostic at any time.

## 9. DATABASE, PRIVACY, ACCESSIBILITY, INTERNATIONALISATION

### 9.1 Database
Normalised PostgreSQL. Tables (adjust names if needed and document changes): `profiles`, `user_roles`, `learning_levels`, `lessons`, `lesson_sections`, `question_categories`, `questions`, `question_versions`, `question_options`, `audio_files`, `image_files`, `attempts`, `answers`, `recordings`, `evaluations`, `evaluation_versions`, `mock_tests`, `mock_test_blueprints`, `test_sessions`, `study_plans`, `learning_progress`, `vocabulary`, `grammar_exercises`, `notifications`, `content_reports`, `ai_usage`, `consents`, `audit_log`.

Use primary keys (UUID), foreign keys, indexes, check constraints, `created_at`/`updated_at` timestamps, soft delete where useful, and RLS on all user-data tables.

### 9.2 Privacy and security
- Explicit consent before the first recording, stored in `consents`.
- Recordings live in **private** storage buckets and are accessed only via short-lived signed URLs.
- **Recordings are deleted automatically after 90 days** (configurable). Transcripts and scores may be kept. Learners can delete any recording at any time.
- Account deletion and data export (GDPR-style) work for all users worldwide.
- Cookie consent banner with non-essential cookies off by default.
- Input validation everywhere, rate limiting on the API, file-type and size checks on uploads, strict CORS, secure headers, and no personal data or audio in logs.
- Privacy policy and terms pages (templates, marked "to be reviewed by a lawyer").

### 9.3 Accessibility and internationalisation
- Meet **WCAG 2.2 AA**: keyboard navigation (including drag and drop), focus states, colour contrast, screen-reader labels, captions/transcripts for audio in Learning mode.
- UI text uses **next-intl** from day one. English is the first language. The structure supports adding translations (for example Hindi, Bengali, Urdu, Arabic, Nepali, Chinese, Vietnamese) and right-to-left layouts later.
- Lesson content supports optional native-language explanation fields per section.

### 9.4 Performance (many learners have older, low-power computers)
- Responsive layout that works from small laptop screens to large monitors, and on a phone or tablet browser if the user opens the app over their own home network.
- Target Lighthouse performance ≥ 90 on the main pages.
- Keep memory use low: the whole app plus the "Minimum" AI tier must run on 8 GB RAM.
- Lazy-load audio and images; compress audio.

## 10. UI/UX

White background, dark navy primary colour, blue and purple accents, clean typography, professional cards, subtle shadows, consistent spacing, rounded components and clear progress indicators. Separate experiences for public visitors, students and administrators. Simple enough for beginner English readers: short labels, icons next to text, one main action per screen. Avoid clutter.

## 11. CONTENT RULES

Every practice question has: unique ID, question type, difficulty (beginner/intermediate/advanced), instructions, content, answer, explanation, learning objective, relevant scoring criteria, key points (for content scoring), source/licence, author, and review status (`draft`, `ai_generated`, `reviewed`, `published`).

- AI-generated content is saved as `ai_generated` and must be approved by a `content_editor` before learners see it.
- Content lives in `content/` as versioned files and is imported into the database by a script, so it can be reviewed in Git.
- **Content targets (minimum, original content only):**
  - M1: 5 lessons and 2 sample questions per question type.
  - M2: complete units for Levels 1–3 (about 60 lessons), vocabulary sets of at least 1,500 words with audio, and at least 30 questions per reading and listening type.
  - M3: at least 30 questions per speaking and writing type, plus a Question-Type Academy page for every type.
  - M4: Levels 4–6 units, at least 5 full original mock exams, 3 section tests per section and 5 mini mocks.
  - Ongoing: a content-generation script (LLM drafts → validation → human review) so the bank can keep growing to hundreds of questions per type.
  - Record actual counts in `STATUS.md`.

## 12. TESTING AND DEFINITION OF DONE

A feature is **done** only when:
1. It works end to end with real database data.
2. It has unit tests, plus integration and e2e tests where relevant.
3. All tests, lint and type checks pass locally and in CI.
4. Error states, loading states and empty states are handled.
5. It is accessible by keyboard and works on mobile width (375 px).
6. Documentation and `STATUS.md` are updated.

Never say a feature works unless you have run its tests and seen them pass. Report real test output.

## 13. DEVELOPMENT RULES

1. Work incrementally. Do not dump the whole application at once.
2. No static-only pages where functionality is required.
3. No fake functionality except clearly labelled mock providers.
4. No hardcoded credentials.
5. Always handle errors.
6. Always integrate with the database.
7. Always write automated tests.
8. Never claim untested features work.
9. Never invent official PTE rules or scoring.
10. Never guarantee scores.
11. Keep code clean, typed, reusable and documented.
12. Keep the platform free.
13. Keep infrastructure and AI costs low.
14. Keep frontend and backend contracts in sync (generate TypeScript types from the FastAPI OpenAPI schema).
15. Update docs whenever architecture changes, and record decisions in `docs/DECISIONS.md`.
16. When something needs an external service or credential, build the interface and a mock, and explain the dependency in `STATUS.md`.
17. Use Git: one branch per milestone (`m1-foundation`, `m2-learning`, ...), small clear commits, merge to `main` only when the milestone's acceptance criteria pass.

## 14. MILESTONES AND ACCEPTANCE CRITERIA

Do not start a milestone until the previous one passes **all** its acceptance criteria.

### M1: Foundation
Build: repo, frontend, backend, local Supabase, schema and migrations, RLS, seed data, design system, landing page, authentication, onboarding (level and target only; the diagnostic comes in M2), dashboard, AI provider interfaces with mock providers, CI.
**Acceptance criteria:**
- [ ] `make setup` then `make start` runs the full app locally, as documented in README, with no API keys or cloud accounts.
- [ ] The dashboard loads its data with one GraphQL query, and GraphQL permission tests pass.
- [ ] A new user can register, receive the verification email (local mail viewer), verify, log in, log out and reset their password.
- [ ] Protected pages redirect logged-out users, and FastAPI rejects requests without a valid JWT (tested).
- [ ] Onboarding saves level and target score to `profiles`.
- [ ] The dashboard shows real data from the database (and correct empty states for a new user).
- [ ] RLS tests prove one user cannot read another user's data.
- [ ] The landing page is responsive, passes an automated accessibility check (axe), and shows the Pearson disclaimer.
- [ ] Backend, frontend and e2e (register → verify → login → onboarding → dashboard) tests pass in CI.

### M2: Learning system
English Academy (Levels 1–3 units, lesson flow from Section 5A.1, vocabulary and pronunciation tracks, end-of-unit tests), learning paths, diagnostic test, question bank, all reading and listening tasks in Learn and Practice modes, mistake notebook, spaced repetition, content import script, Kokoro audio generation script.
**Acceptance:** a learner completes the diagnostic, gets a level and a plan, finishes a full unit and its end-of-unit test, sees wrong answers in the mistake notebook and gets them back in spaced review, answers every reading and listening type with correct auto-marking and explanations, and progress updates on the dashboard. All tests pass.

### M3: Speaking and writing
Recording with consent, upload, background evaluation jobs, the local AI stack from Section 6 (faster-whisper, Silero VAD, alignment, pronunciation, LanguageTool, embeddings, Ollama), speaking and writing evaluators, Question-Type Academy pages for all 22 types, and Timed drill mode.
**Acceptance:** each speaking and writing task can be attempted and returns a structured evaluation (Section 7.2) with bands and explanations, using local providers when available and mocks in CI. Evaluator unit tests use fixed sample audio and text with expected outputs. No 10–90 scores are shown.

### M4: Mock examinations
Blueprint-driven exam engine (Section 5A.4), pre-test microphone check, timers, recording beeps and auto-stop rules, navigation rules, auto-submit, resume after a browser refresh, full mocks, section tests, mini mocks, results report, Levels 4–6 units.
**Acceptance:** a full original mock exam can be completed end to end in Exam mode, following the blueprint. Unverified blueprint rules are listed in `STATUS.md`. E2E test covers a shortened test blueprint.

### M5: AI personalisation
AI tutor, weakness analysis, adaptive difficulty, daily plans, weekly check-ins, readiness indicator, recommendations, optional in-browser transcription.
**Acceptance:** recommendations change based on real attempt history (tested with seeded users). The tutor adapts to the learner's level, stays on topic and respects rate limits.

### M6: Analytics
Progress charts, question-type performance, trends, historical comparison, report export.
**Acceptance:** charts are drawn from real data, accessible (data table alternative) and correct against seeded test data.

### M7: Administration
Admin dashboard, content management with review workflow, user management, uploads, blueprint management, content reports, usage monitoring, calibration tool.
**Acceptance:** only `admin`/`content_editor` roles can access admin features (tested). AI-generated content cannot be published without approval.

### M8: Public open-source release
Security review (OWASP Top 10 checklist), dependency and licence audit (code, AI models, word lists, audio voices), secret scan of the full Git history, performance optimisation for low-power computers, local backup/restore commands, final README and docs, licence files, GitHub release `v1.0.0` with release notes.
**Acceptance:** a person with a fresh computer (Windows, macOS and Linux tested, or documented if not tested) can clone the public repo, run the one-command setup from the README alone, create an account and complete a lesson, a speaking task and a mini mock. All CI checks pass. No secrets or personal data are in the repository. A final `STATUS.md` lists remaining known limitations.

## 15. REPORTING (END OF EVERY SESSION)

Update `STATUS.md` with, and also reply to the user with:
- Current milestone and acceptance-criteria checklist (ticked or not)
- What was implemented
- Files created / modified
- Installation commands
- Configuration needed (env variables)
- Database changes (migration names)
- Tests run and **real results**
- Known issues and limitations
- Items needing the owner's decision or verification (for example unverified exam rules, legal review)
- The exact next step

