# API

Base URL (local): `http://localhost:8000`. Interactive docs in development: `/docs`.
Every endpoint except health needs `Authorization: Bearer <Supabase access token>`.
Errors: `{"error": {"code": "...", "message": "...", "details"?: [...]}}`. Rate limit: 120 requests/minute/client (429).

## REST (actions)
| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/health` | | status + AI provider names |
| GET | `/health/ready` | | database check (503 if down) |
| PUT | `/api/v1/me/onboarding` | `{level_code 1-6, target_score 10-90, exam_date?, daily_goal_minutes 15/30/60/120}` | saved values |
| GET | `/api/v1/me/export` | | all of the user's data (JSON) |
| DELETE | `/api/v1/me` | `{"confirm": "DELETE"}` | 204; deletes auth user, everything cascades |

## GraphQL (reads) at `/graphql`
Schema: `apps/web/src/graphql/schema.graphql` (generated). Main fields:
- `viewer { id email roles demoMode profile progress streakDays todayMinutes recentAttempts recommendedLessons weakAreas mockExams }`
- `learningLevels`, `questionCategories`

Limits: depth 8, 2000 tokens, 15 aliases. Introspection only when `ENVIRONMENT=development`.
