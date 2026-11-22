# Security review (OWASP Top 10, 2021) · v1.0.0 · 2026-11-22

TutorBot English AI runs on the learner's own computer. Every port is bound to 127.0.0.1. This review checks the
app against each OWASP Top 10 category, says how it is handled and names the test that proves it. "Not tested"
means exactly that.

| # | Risk | How it is handled | Proof |
|---|---|---|---|
| A01 | Broken access control | Row-Level Security on every table; the API runs user queries as `authenticated` with the caller's JWT claims (`user_session`), so RLS also covers API traffic. Admin routes use `require_role`. The admin pages return 404 to non-staff. Exam state, roles and the audit log can only be written by the API's service role. AI-drafted questions cannot be published without approval: a database trigger enforces this, and the approver must be a different staff member. | `test_integration.py` (RLS between users, role escalation blocked), `test_admin.py` (every admin route returns 401/403, trigger blocks direct SQL), `test_exams.py` (learners cannot edit exam state), e2e `admin.spec.ts` |
| A02 | Cryptographic failures | No passwords are stored by the app (Supabase GoTrue uses bcrypt). JWTs are ES256 and checked against JWKS for signature, expiry, audience and issuer. Everything runs locally. Locally HTTP is used, which is acceptable on 127.0.0.1 only. | `test_security.py` (bad signature, expired, wrong audience/issuer, `alg=none`) |
| A03 | Injection | All SQL uses bound parameters (SQLAlchemy `text()` with parameters). The 8 f-strings in SQL hold only constant column lists or table names from a fixed list in our code, and are marked `noqa: S608`. GraphQL has depth, token and alias limits. Markdown is rendered without raw HTML. | `test_integration.py` GraphQL limit tests; code review: `grep -rn "f\"select" apps/api/app` |
| A04 | Insecure design | Scores come from measurable signals; the LLM only writes text. Bands only, with no 10-90 numbers until calibration (SPEC 7.3). Daily limits on AI feedback and tutor messages. The tutor refuses off-topic requests and score promises without calling the LLM. | `test_evaluators.py`, `test_tutor.py`, `test_admin.py::test_calibration_agreement` |
| A05 | Security misconfiguration | Security headers on API and web. The web app has a Content-Security-Policy (self + local API/Supabase only; no third-party scripts) and `frame-ancestors 'none'`. Microphone access is self-only. No `X-Powered-By`. Unused Supabase services are off. Containers run as non-root. | `curl -I http://127.0.0.1:3000` shows the headers; full e2e suite passes with CSP on |
| A06 | Vulnerable components | `pnpm audit --prod` and `pip-audit` return "No known vulnerabilities found" (2026-11-22). Lock files are committed and CI installs with `--frozen-lockfile` / `uv sync --frozen`. | See docs/LICENCE_AUDIT.md for the commands |
| A07 | Identification and authentication failures | Supabase Auth: email confirmation, password reset by emailed link, minimum password length 8 (client and GoTrue). API rate limit per IP (120/min). Sessions refresh in `proxy.ts`. | e2e `auth-flow.spec.ts` (register → verify → login → logout → reset → delete) |
| A08 | Software and data integrity failures | Content goes into the database only through `build_seed.py` (validated) or the admin upload, which uses the same checks. Every content edit makes a new version that needs a new approval. CI checks that `seed.sql` and the generated types are up to date. | `test_admin.py` (edit → version 2 → publish refused), CI job "Content is valid" |
| A09 | Logging and monitoring failures | JSON logs without personal data (no emails, tokens or answers). The audit log records role changes, reviews, publishing, uploads, blueprint changes and report decisions. The admin overview shows AI usage and failed jobs. | `test_admin.py::test_admin_manages_roles_and_audit_log` |
| A10 | Server-side request forgery | The API calls only fixed local URLs from configuration (LanguageTool, Ollama). No user-supplied URL is ever fetched. | Code review: `grep -rn "httpx" apps/api/app` |

## Other checks
- **Secrets:** `python3 scripts/secret_scan.py` scans every commit on every branch (CI job "Secret scan"). Result on
  2026-11-22: no secrets in 38 commits and 371 tracked files. The local Supabase keys are public development
  defaults. Real `.env` files are git-ignored.
- **Personal data:** recordings, backups, models and `.env` are git-ignored. Account deletion removes all rows
  (cascade) and recording files (`test_integration.py::test_account_deletion_removes_everything`).
- **Uploads:** recordings are size-limited (3 MB), type-checked and stored outside the web root under random ids.
- **Calibration privacy:** admins rate only their own sample answers; learners' answers are never shown to staff.

## Known gaps
- Not tested with a professional penetration test.
- The CSP allows `'unsafe-inline'` scripts because Next.js needs inline hydration scripts. A nonce-based CSP is a
  future improvement.
- Local HTTP only. Anyone exposing the app beyond 127.0.0.1 must add HTTPS and change the Supabase keys first.
