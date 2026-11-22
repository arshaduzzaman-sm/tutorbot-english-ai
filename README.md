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

## Status

Milestone 1 (foundation) is built: landing page, accounts (register, email confirmation, login, logout,
password reset, data export, account deletion), onboarding (level and target score), and the dashboard.
AI runs in **demo mode** (mock providers) until Milestone 3 adds the local AI models. See [STATUS.md](STATUS.md).

## Requirements

| Tool | Why | Install |
|---|---|---|
| Docker Desktop (or Docker Engine) | Runs the database and the app | https://docs.docker.com/get-docker/ |
| Node.js 20+ and pnpm | Website | https://nodejs.org/ then `corepack enable` |
| Supabase CLI | Local database, login and email viewer | https://supabase.com/docs/guides/local-development/cli/getting-started |
| Python 3.12+ and uv | Backend tools and tests | https://www.python.org/ and https://docs.astral.sh/uv/ |
| Git and make | Get the code, run commands | Windows: use WSL2, or `scripts/setup.ps1` |

### Hardware

| Tier | Computer | AI setup (from Milestone 3) |
|---|---|---|
| Minimum | CPU only, 8 GB RAM | Whisper `small`, a small LLM (about 3-4B). Evaluations are slower. |
| Recommended | 16 GB RAM, optional GPU | Whisper `large-v3-turbo`, an LLM of about 7-8B. |
| Low-power / developer | Anything that runs Docker | Mock AI only: `make mock` |

Disk: about 6 GB for Docker images in Milestone 1 (more later for AI models).

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
| `make help` | List every command. |

## Delete or reset your data

- **One account:** log in, open **Profile**, and use *Download my data* or *Delete my account*.
- **Everything:** `make reset` deletes all local accounts, progress and recordings (it asks you to type `yes`).
- **Remove the app completely:** `make stop`, then `supabase stop --no-backup` and delete the folder.

## Update to a new version

```bash
make update     # git pull, install, apply new database migrations, rebuild (keeps your data)
```

## Project layout

See [docs/CODEMAP.md](docs/CODEMAP.md). The full specification is [docs/SPEC.md](docs/SPEC.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please read the content rules: **never add copied exam questions.**

## Licence

- Code: [MIT](LICENSE)
- Original learning content in `content/`: [CC BY-SA 4.0](content/LICENSE.md)
