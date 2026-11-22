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
| — | Numeric 10-90 estimates: threshold to be set in M7 calibration | SPEC 7.3. Not enabled. |
