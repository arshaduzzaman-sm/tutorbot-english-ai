# Security

TutorBot English AI runs locally, but please still report security problems privately.

- **Do not** open a public issue for a vulnerability. Use GitHub's "Report a vulnerability"
  (Security → Advisories) on this repository.
- Include steps to reproduce and the version (git commit).

Design notes: JWT verified on every protected API request; Row-Level Security on every table; services bound
to 127.0.0.1; no secrets in the repository (the local Supabase keys are public development defaults).
