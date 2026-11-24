# CLAUDE.md: rules for AI coding agents (read every session)

TutorBot English AI: free, open-source, **local-only** English + PTE Academic prep app.
Full spec: `docs/SPEC.md`. **Do not read all of it.** Open only the section you need (numbers below).
Current state and next step: `STATUS.md`. Find files with `docs/CODEMAP.md`, then `grep`.

## Non-negotiable rules
1. Free forever. No paywalls. Never guarantee a score. (SPEC 2.2)
2. Every estimate says "Practice estimate: not an official PTE score". No 10-90 scores until calibrated (SPEC 7.3).
3. Never copy Pearson or other copyrighted questions. Never invent PTE rules, timings or scoring.
   Unverified rule → `"verified": false` + list it in STATUS.md (SPEC 5A.2, Module 9).
4. Pearson disclaimer in footer, terms and about pages (exact text in `apps/web/messages/en.json` footer.disclaimer).
5. Local only: no cloud services, no API keys required. Bind ports to 127.0.0.1. (SPEC 3.2)
6. Never commit secrets, `.env`, user data, recordings or model weights.
7. No fake functionality except mock AI providers labelled `provider: "mock"` + "Demo mode" banner.
8. Never claim something works without running its tests. Report real output.

## Fixed tech decisions (change only with a reason in docs/DECISIONS.md)
- Frontend `apps/web`: Next.js 16 App Router, TS strict, Tailwind v4, shadcn/ui-style components, next-intl,
  urql (`@urql/core`) + GraphQL Codegen, openapi-fetch + openapi-typescript. Next 16 uses `src/proxy.ts` (not middleware).
- Backend `apps/api`: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 async, Strawberry GraphQL at `/graphql`
  (reads), REST under `/api/v1` (actions). uv for packages.
- DB: local Supabase (Postgres 17). **Schema = `supabase/migrations/*.sql` only. No Alembic.**
- Users: Supabase `auth.users` + `public.profiles` (created by trigger `handle_new_user`). No `users` table.
- Auth: frontend `@supabase/ssr`; API verifies JWT (JWKS ES256; signature, exp, aud, iss) on every protected route.
- RLS on every table. The API runs user queries as role `authenticated` with JWT claims (`user_session`),
  so RLS applies to API traffic too. `service_session` is privileged: only for things RLS cannot do.
- Roles: `student`, `content_editor`, `admin` in `user_roles`; check with `require_role(...)`.
- AI: interfaces in `apps/api/app/ai/interfaces`, chosen by env (`*_PROVIDER=local|mock`). Scores come from
  measurable signals; the LLM only writes explanations (SPEC 6.1).
- Content: `content/` JSON → `scripts/build_seed.py` → `supabase/seed.sql` (generated, never hand-edit).

## Folder map
```
apps/api/app/   api/ (REST routers)  core/ (config, security, errors, logging, ratelimit)
                db/ (models, session)  graphql/ (schema, context+DataLoaders)  services/ (logic)
                ai/ (interfaces, providers/mock|local, evaluation)  workers/ (jobs, M3)
apps/web/src/   app/ (routes)  components/ (ui/ = design system)  lib/ (supabase, api, validation)
                graphql/ (queries.ts, schema.graphql, generated/)  api/ (openapi.json, schema.d.ts)
apps/web/messages/en.json   all UI text (i18n)
supabase/       migrations/, seed.sql (generated), templates/ (auth emails), config.toml
content/        levels, question_categories, lessons/, questions/, blueprints/
tests/e2e/      Playwright specs (app must be running)
scripts/        setup, write-env, build_seed, download-models, detect-hardware
docs/           SPEC, CODEMAP, DECISIONS, ARCHITECTURE, API, AI_MODELS, CONTENT_GUIDE, PRIVACY, LEGAL_NOTES, HISTORY,
                SECURITY_REVIEW, LICENCE_AUDIT, releases/
```

## Commands
```
make setup / start / stop / dev / mock / reset / update / status
make test-api      # cd apps/api && REQUIRE_DB=1 uv run pytest -q
make test-web      # vitest
make test-e2e      # Playwright; needs app running (make start or make dev)
make lint typecheck
make codegen       # after changing GraphQL schema or REST routes: regenerates frontend types (CI checks this)
make seed          # after editing content/
make backup / restore DIR=...   make admin EMAIL=...   python3 scripts/secret_scan.py
supabase migration new <name>   # new schema change, then: supabase db reset (local data is wiped)
```

## Workflow and token-saving rules (SPEC 3.3)
- One small task per session. Commit after each task. Branch per milestone (`m1-foundation`, `m2-learning`, ...).
- Merge to `main` only when every acceptance criterion of the milestone passes (SPEC 14).
- Search before reading. Never open lock files, `node_modules`, `.next`, generated files, model files, seed.sql.
- Run tests quietly (`pytest -q`, `vitest run --silent`) and read only failures.
- Targeted edits, not whole-file rewrites. Generate repetitive content with scripts.
- Keep this file < 150 lines and STATUS.md < 100 lines. Move finished history to docs/HISTORY.md.
- Update docs/CODEMAP.md when adding important files. Record decisions in docs/DECISIONS.md.
- When something needs an external service, build the interface + mock and note it in STATUS.md.

## Where to look in docs/SPEC.md
| Topic | Section |
|---|---|
| Product rules, disclaimer | 2, 2.2 |
| Stack and architecture | 3, 3.1 |
| Local-only + public repo rules | 3.2 |
| Modules (landing, auth, dashboard, ...) | 5 |
| Curriculum, 22 task types, practice modes, mock exams, learning loop | 5A |
| AI architecture, providers, hardware tiers | 6 |
| Evaluation engine, result shape, score display | 7 |
| Learning paths, onboarding | 8 |
| DB tables, privacy, accessibility, i18n, performance | 9 |
| UI/UX | 10 |
| Content rules and targets | 11 |
| Definition of done | 12 |
| Development rules | 13 |
| Milestones + acceptance criteria | 14 |
| End-of-session report format | 15 |

## Gotchas
- Local Supabase signs JWTs with ES256 (JWKS). Tests pin their own key (`tests/helpers.py`).
- GoTrue's token `iss` is the public URL (`http://127.0.0.1:54321/auth/v1`); in Docker set `JWT_ISSUER`.
- One SQLAlchemy AsyncSession is not concurrency-safe: GraphQL resolvers use `Context.execute` (locked).
- Behind Docker, build redirect URLs with `publicOrigin()` (lib/origin.ts), not `request.nextUrl.origin`.
- Auth emails use `/auth/confirm?token_hash=...` (templates in supabase/templates). Mail viewer: :54324.
