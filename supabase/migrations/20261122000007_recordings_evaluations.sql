-- Speaking and writing (SPEC 5 modules 5-6, 6.1.6, 7): recordings and background evaluation jobs.
-- Audio files live on the API's local disk (RECORDINGS_DIR, git-ignored); this table only stores metadata.
-- Every evaluation is a job: queued -> running -> done | failed. The worker updates jobs with the service role.

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  duration_seconds numeric(6, 2) check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);
create index recordings_user_idx on public.recordings (user_id, created_at desc);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  category_id uuid references public.question_categories (id),
  recording_id uuid references public.recordings (id) on delete set null,
  test_session_id uuid references public.test_sessions (id) on delete cascade,
  mode public.practice_mode not null default 'practice',
  response_text text, -- typed answer (writing) or the transcript once known (speaking)
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  result jsonb,
  error text,
  score_ratio numeric(5, 4) check (score_ratio between 0 and 1),
  provider text check (provider in ('local', 'mock')),
  duration_seconds integer check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index evaluations_queue_idx on public.evaluations (created_at) where status = 'queued';
create index evaluations_user_idx on public.evaluations (user_id, created_at desc);
create index evaluations_question_idx on public.evaluations (user_id, question_id, created_at desc);

alter table public.recordings enable row level security;
alter table public.evaluations enable row level security;
revoke all on public.recordings, public.evaluations from anon;
grant select, insert, delete on public.recordings to authenticated;
grant select, insert on public.evaluations to authenticated;

create policy "own recordings" on public.recordings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "read own evaluations" on public.evaluations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "queue own evaluations" on public.evaluations for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'queued' and result is null);
