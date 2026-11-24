-- Question-Type Academy guides, exam blueprints and the exam engine state (SPEC 5A.2, 5A.4, M4).

alter table public.question_categories add column guide jsonb not null default '{}'::jsonb;

create table public.blueprints (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  version text not null,
  name text not null,
  kind text not null check (kind in ('full_mock', 'section_test', 'mini_mock')),
  spec jsonb not null,
  verified boolean not null default false,
  status public.content_status not null default 'published',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.blueprints enable row level security;
revoke all on public.blueprints from anon;
grant select on public.blueprints to authenticated;
create policy "read published blueprints" on public.blueprints for select to authenticated
  using (status = 'published');

-- The exam engine keeps its state on the session row. Only the API (service role, after checking the owner)
-- changes it, so a learner cannot move back, stop the clock or edit marks through the database API.
alter table public.test_sessions
  add column blueprint_code text,
  add column state jsonb not null default '{}'::jsonb,
  add column current_index integer not null default 0 check (current_index >= 0),
  add column section_deadline timestamptz;

drop policy "own test sessions" on public.test_sessions;
create policy "read own test sessions" on public.test_sessions for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.test_sessions from authenticated;
