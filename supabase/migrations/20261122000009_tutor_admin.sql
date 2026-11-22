-- M5 tutor chat history and M7 administration: content reviews, content reports, uploads, calibration.

-- ---------- Tutor ----------
create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  on_topic boolean not null default true,
  provider text check (provider in ('local', 'mock')),
  created_at timestamptz not null default now()
);
create index tutor_messages_user_idx on public.tutor_messages (user_id, created_at desc);
alter table public.tutor_messages enable row level security;
revoke all on public.tutor_messages from anon, authenticated;
grant select, insert, delete on public.tutor_messages to authenticated;
create policy "own tutor messages read" on public.tutor_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own tutor messages insert" on public.tutor_messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own tutor messages delete" on public.tutor_messages for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- Content review workflow ----------
-- Every question carries its origin. A question can only become published through the API after a staff member
-- approved its current version. AI-drafted content therefore can never be published without a human approval.
alter table public.questions add column origin text not null default 'human' check (origin in ('human', 'ai'));
alter table public.questions add column created_by uuid references auth.users (id) on delete set null;

create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  version integer not null,
  reviewer_id uuid references auth.users (id) on delete set null,
  decision text not null check (decision in ('approve', 'request_changes')),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index content_reviews_question_idx on public.content_reviews (question_id, version);
alter table public.content_reviews enable row level security;
revoke all on public.content_reviews from anon, authenticated;
grant select, insert on public.content_reviews to authenticated;
create policy "staff read reviews" on public.content_reviews for select to authenticated using (public.is_staff());
create policy "staff write reviews" on public.content_reviews for insert to authenticated
  with check (public.is_staff() and reviewer_id = (select auth.uid()));

-- Editing the content of a question bumps its version, so an old approval does not cover new text.
create or replace function public.guard_question_publish() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;  -- seed and maintenance run as postgres / service role
  end if;
  if tg_op = 'UPDATE' and (new.instructions, new.content, new.answer, new.explanation, new.difficulty)
       is distinct from (old.instructions, old.content, old.answer, old.explanation, old.difficulty) then
    new.version := old.version + 1;
  end if;
  if tg_op = 'UPDATE' then
    new.origin := old.origin;  -- the origin of a question cannot be changed afterwards
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published' or new.version <> old.version) then
    if not exists (
      select 1 from public.content_reviews r
      where r.question_id = new.id and r.version = new.version and r.decision = 'approve'
        and (new.origin = 'human' or r.reviewer_id is distinct from new.created_by)
    ) then
      raise exception 'publish_needs_approval' using errcode = 'P0001',
        hint = 'A staff member must approve this version before it is published.';
    end if;
  end if;
  return new;
end $$;
create trigger questions_guard_publish before insert or update on public.questions
  for each row execute function public.guard_question_publish();

-- ---------- Content reports (learners flag a problem with a question) ----------
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  question_id uuid not null references public.questions (id) on delete cascade,
  reason text not null check (reason in ('wrong_answer', 'unclear', 'typo', 'audio', 'offensive', 'other')),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index content_reports_status_idx on public.content_reports (status, created_at desc);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant select, insert, update on public.content_reports to authenticated;
create policy "report read" on public.content_reports for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy "report create" on public.content_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');
create policy "staff resolve reports" on public.content_reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- Uploads (admin content imports) ----------
create table public.content_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users (id) on delete set null,
  filename text not null,
  origin text not null check (origin in ('human', 'ai')),
  created_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.content_uploads enable row level security;
revoke all on public.content_uploads from anon, authenticated;
grant select, insert on public.content_uploads to authenticated;
create policy "staff uploads" on public.content_uploads for all to authenticated
  using (public.is_staff()) with check (public.is_staff() and uploaded_by = (select auth.uid()));

-- ---------- Blueprints: admins manage them ----------
grant update on public.blueprints to authenticated;
create policy "admins read all blueprints" on public.blueprints for select to authenticated
  using (public.has_role('admin'));
create policy "admins update blueprints" on public.blueprints for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------- Calibration: humans rate AI evaluations (SPEC 7.3) ----------
-- Admins rate only their own sample evaluations (RLS on evaluations), so learners' answers are never shown.
create table public.calibration_ratings (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  rater_id uuid references auth.users (id) on delete set null,
  task_type text not null,
  bands jsonb not null,  -- {"criterion": "needs_work|developing|good|strong"}
  created_at timestamptz not null default now(),
  unique (evaluation_id, rater_id)
);
alter table public.calibration_ratings enable row level security;
revoke all on public.calibration_ratings from anon, authenticated;
grant select, insert, update on public.calibration_ratings to authenticated;
create policy "admins calibration" on public.calibration_ratings for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin') and rater_id = (select auth.uid()));
