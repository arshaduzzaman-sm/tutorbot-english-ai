-- Placement (diagnostic) test and personalised study plans (SPEC 8).

create table public.placement_tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  version integer not null default 1 check (version > 0),
  estimated_minutes smallint not null default 15,
  items jsonb not null default '[]'::jsonb, -- includes answers: only the API (service code) marks them
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  placement_test_id uuid references public.placement_tests (id) on delete set null,
  recommended_level_code smallint not null check (recommended_level_code between 1 and 6),
  skill_scores jsonb not null default '{}'::jsonb,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index study_plans_user_created_idx on public.study_plans (user_id, created_at desc);

create trigger set_updated_at before update on public.placement_tests
  for each row execute function public.set_updated_at();

alter table public.placement_tests enable row level security;
alter table public.study_plans enable row level security;
revoke all on public.placement_tests, public.study_plans from anon;
grant select on public.placement_tests to authenticated;
grant select, insert, delete on public.study_plans to authenticated;

create policy "read published placement tests" on public.placement_tests for select to authenticated
  using (status = 'published' or public.is_staff());
create policy "own study plans" on public.study_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
