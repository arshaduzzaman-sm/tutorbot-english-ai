# Privacy (developer notes)

- All data stays in the local Supabase database on the user's computer. No analytics, no trackers, no cloud.
- Consent is stored in `consents` (terms at signup; recording consent before first recording, M3).
- Recordings (M3) go to private storage buckets, accessed only via short-lived signed URLs, auto-deleted after
  90 days (configurable). Users can delete any recording.
- Account deletion (`DELETE /api/v1/me`) removes the auth user; all user rows cascade. The action is logged
  in `audit_log` with ids only.
- Data export (`GET /api/v1/me/export`) returns every user-owned row.
- Logs contain method, path, status and timing only: no tokens, bodies, emails or audio.
- Only essential cookies (session + cookie-notice choice). Optional cookies are off.
- User-facing text: `/privacy` page (template, to be reviewed by a lawyer).
