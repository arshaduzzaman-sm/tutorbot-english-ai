# Architecture (M1)

```
Browser ──(auth only: sign up, login, reset)──▶ Supabase Auth (local, :54321) ──▶ emails ▶ Mailpit (:54324)
   │
   ├─ Next.js web (:3000) ── server components ──GraphQL/REST + user JWT──┐
   └─ client forms ─────────────REST + user JWT───────────────────────────┤
                                                                          ▼
                                              FastAPI (:8000)  /graphql (reads)  /api/v1 (actions)
                                                 │ verifies JWT (JWKS) on every protected request
                                                 ▼
                                   Postgres (Supabase, :54322) with RLS on every table
```

- **Reads** use GraphQL (Strawberry). The dashboard is one query. DataLoaders batch level/category lookups.
  Depth (8), token (2000) and alias (15) limits; introspection off outside development.
- **Writes/actions** use REST with OpenAPI. The frontend's REST and GraphQL types are generated (`make codegen`).
- **RLS as a real second layer:** for each request the API opens a transaction, runs `set local role authenticated`
  and sets `request.jwt.claims`, so Postgres policies (`auth.uid()`) apply to API queries too.
  Only account deletion uses the privileged connection, after the JWT check, and it is written to `audit_log`.
- **Profiles** are created by the `on_auth_user_created` trigger (profile + `student` role + terms consent).
- **AI** sits behind interfaces with `mock` (now) and `local` (M3) providers. Deterministic signals produce
  scores/bands; the LLM only explains. Evaluations will be background jobs (Postgres-backed queue, M3).
- **Docker:** Supabase runs via its CLI; `docker-compose.yml` runs `api` and `web`, reaching Supabase through
  `host.docker.internal`. All ports bind to 127.0.0.1.
