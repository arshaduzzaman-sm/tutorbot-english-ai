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
