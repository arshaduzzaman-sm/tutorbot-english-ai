# TutorBot English AI

**Learn English. Master PTE. Achieve Your Target.**

TutorBot English AI is a **free, open-source** app that teaches English from the very first letters up to advanced
academic English, and prepares you for every task in the **PTE Academic** test. It gives practice and AI feedback.
Your results depend on your study and practice. **Nobody can guarantee a score**, and every estimate in the app is a
*practice estimate, not an official PTE score*.

> TutorBot English AI is an independent learning platform. It is not affiliated with, endorsed by, or sponsored by
> Pearson. PTE and PTE Academic are trademarks of Pearson.

## It runs on your own computer

There is no website, no cloud server and no subscription. You download the code and run it with Docker.
Your account, progress and any recordings are stored **only on the computer where the app runs**.
All services listen on `127.0.0.1` (your computer only), so other devices on your network cannot reach them
unless you change that on purpose.

## What is inside (v1.0.0)

- **Course:** 6 levels from Beginner (pre-A1) to C1+, 95 lessons in 21 units (Learn, See, Try, Check), end-of-unit
  tests, a placement test, vocabulary flashcards (1,561 words) and pronunciation drills.
- **All 22 PTE Academic question types:** a guide page for each (what it tests, how it is scored, strategy, strong /
  medium / weak examples), practice with instant marking for reading and listening, AI feedback for speaking and
  writing, and timed drills. 446 original practice questions.
- **Mock exams:** full, section and mini mocks with timers, resume after a reload and a report by section, skill
  and task type.
- **Your coach:** next steps chosen from your own answers, questions at the right difficulty, a readiness guide,
  a weekly check-in, a daily plan and a mistake notebook with spaced review.
- **Tutor chat** that answers English and PTE questions at your level.
- **Progress charts** with data tables and a CSV report.
- **Admin area** for content review (AI-drafted questions need a human approval), learner reports, uploads,
  user roles, mock exam set-up, usage and AI calibration.

Feedback is shown as bands (*needs work, developing, good, strong*), never as a 10-90 score. AI runs in
**demo mode** (mock providers, clearly labelled) until you install the local models. See [STATUS.md](STATUS.md)
for known limitations.

## Requirements

| Tool | Why | Install |
|---|---|---|
| Docker Desktop (or Docker Engine) | Runs the database and the app | https://docs.docker.com/get-docker/ |
| Node.js 20+ and pnpm | Website | https://nodejs.org/ then `corepack enable` |
| Supabase CLI | Local database, login and email viewer | https://supabase.com/docs/guides/local-development/cli/getting-started |
| Python 3.12+ and uv | Backend tools and tests | https://www.python.org/ and https://docs.astral.sh/uv/ |
| Git and make | Get the code, run commands | Windows: use WSL2, or `scripts/setup.ps1` |

### Hardware

| Tier | Computer | AI setup |
|---|---|---|
| Minimum | CPU only, 8 GB RAM | Whisper `small`, a small LLM (about 3-4B). Evaluations are slower. |
| Recommended | 16 GB RAM, optional GPU | Whisper `large-v3-turbo`, an LLM of about 7-8B. |
| Low-power / developer | Anything that runs Docker | Mock AI only: `make mock` |

In demo mode the whole app uses about 0.9 GB of memory (measured: database 167 MB, API 121 MB, website 351 MB,
other local services about 270 MB). Disk: about 6 GB for Docker images, plus 1-6 GB for AI models.

### Real AI feedback (optional)

```bash
docker compose --profile ai up -d          # LanguageTool and Ollama
docker compose exec ollama ollama pull qwen3:4b
INSTALL_AI=1 make start                    # rebuilds the API with speech-to-text and embeddings
```

(In developer mode, `make dev`, install the same packages with `cd apps/api && uv sync --group ai`.) Then set `STT_PROVIDER=local`, `PRONUNCIATION_PROVIDER=local`, `FLUENCY_PROVIDER=local`, `GRAMMAR_PROVIDER=local`,
`EMBEDDER_PROVIDER=local` and `LLM_PROVIDER=local` in `.env` and run `make start`. Details and licences:
[docs/AI_MODELS.md](docs/AI_MODELS.md).

## Setup (one command)

```bash
git clone https://github.com/<owner>/tutorbot-english-ai.git
cd tutorbot-english-ai
make setup      # checks tools, installs, starts the local database, loads lessons, writes .env files
make start      # starts everything
```

Open **http://localhost:3000**.

- Confirmation and password-reset emails go to the **local email viewer**: http://127.0.0.1:54324
- API docs (developer): http://localhost:8000/docs
- Demo accounts (local only, fake passwords): `demo.student@example.test` / `DemoStudent-123!` and
  `demo.admin@example.test` / `DemoAdmin-123!`

Windows without WSL: run `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1`, then
`supabase start` and `docker compose up -d --build`.

No API keys and no cloud accounts are needed.

## Everyday commands

| Command | What it does |
|---|---|
| `make start` / `make stop` | Start or stop the app. Stopping keeps your data. |
| `make mock` | Start with mock AI only (for low-power computers). |
| `make status` | Show the local addresses of all services. |
| `make test` | Run all tests (backend, frontend, end-to-end). |
| `make dev` | Developer mode with hot reload. |
| `make backup` / `make restore DIR=backups/<date>` | Back up or restore all local data (accounts, progress, recordings). |
| `make admin EMAIL=you@example.com` | Give your account the admin role (then log out and in again). |
| `make help` | List every command. |

## Delete or reset your data

- **One account:** log in, open **Profile**, and use *Download my data* or *Delete my account*.
- **Everything:** `make reset` deletes all local accounts, progress and recordings (it asks you to type `yes`).
- **Remove the app completely:** `make stop`, then `supabase stop --no-backup` and delete the folder.

## Admin area

Register normally, then run `make admin EMAIL=you@example.com` and log in again. Open **Profile → Open the
admin area**. The local demo admin (`demo.admin@example.test`) already has the role.

## Update to a new version

```bash
make backup     # recommended first
make update     # git pull, install, apply new database migrations, rebuild (keeps your data)
```

## Tested on

Linux (Ubuntu 24.04) with Docker. Windows (WSL2 or `scripts/setup.ps1`) and macOS are supported by the scripts but
have **not been tested yet**. Please report any problem in an issue.

## Security and licences

[docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) (OWASP Top 10 checklist) and
[docs/LICENCE_AUDIT.md](docs/LICENCE_AUDIT.md). Report vulnerabilities privately: [SECURITY.md](SECURITY.md).

## Project layout

See [docs/CODEMAP.md](docs/CODEMAP.md). The full specification is [docs/SPEC.md](docs/SPEC.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please read the content rules: **never add copied exam questions.**

## Licence

- Code: [MIT](LICENSE)
- Original learning content in `content/`: [CC BY-SA 4.0](content/LICENSE.md)
