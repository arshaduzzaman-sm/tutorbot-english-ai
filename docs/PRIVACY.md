# Privacy (developer notes)

- All data stays on the user's computer: the local Supabase database plus the `recordings/` folder. No analytics,
  no trackers, no cloud, no third-party scripts (the web app's Content-Security-Policy allows only this site, the
  local API and local Supabase).
- Consent is stored in `consents`: terms at signup, and voice-recording consent before the first recording. It can
  be withdrawn on the profile page; new recordings are then refused.
- Recordings are files under `recordings/<user id>/<random id>` (git-ignored, outside the web root), served only to
  their owner through the API. They are deleted when the account is deleted. There is no automatic expiry yet.
- Tutor chat messages are stored in `tutor_messages` (own rows only, RLS). Learners can clear them on the tutor page.
- Staff access: content editors and admins can read profiles and learner reports about questions; admins also see
  each account's email, join date and number of answers (user management) and usage totals. Staff
  cannot read learners' answers, evaluations, recordings or tutor messages. The calibration tool
  uses only the admin's own sample answers.
- Account deletion (`DELETE /api/v1/me`) removes the auth user; all user rows cascade and recording files are
  removed. The action is logged in `audit_log` with ids only.
- Data export (`GET /api/v1/me/export`) returns every user-owned row, including recordings metadata, evaluations
  and tutor messages. `GET /api/v1/me/progress-report.csv` gives a progress summary.
- Backups (`make backup`) contain personal data. They are written to `backups/` (git-ignored, owner-only file
  permissions) and should be kept private.
- Logs contain method, path, status and timing only: no tokens, bodies, emails or audio.
- Only essential cookies (session + cookie-notice choice). Optional cookies are off.
- User-facing text: `/privacy` page (template, to be reviewed by a lawyer).
