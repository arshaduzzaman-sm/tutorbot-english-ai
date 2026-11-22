-- Units (SPEC 5A.1): each level is split into units of lessons with an end-of-unit test.
-- A learner unlocks the next unit by scoring at least 80% on the test (or by placing higher).

create table public.units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  learning_level_id uuid not null references public.learning_levels (id),
  title text not null,
  summary text not null default '',
  sort_order smallint not null default 0,
  test_items jsonb not null default '[]'::jsonb, -- includes answers: only the API marks them
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index units_level_idx on public.units (learning_level_id, sort_order);

alter table public.lessons add column unit_id uuid references public.units (id) on delete set null;
create index lessons_unit_idx on public.lessons (unit_id, sort_order);

create table public.unit_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  best_score numeric(5, 4) not null check (best_score between 0 and 1),
  attempts integer not null default 1 check (attempts > 0),
  passed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, unit_id)
);

create trigger set_updated_at before update on public.units
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.unit_progress
  for each row execute function public.set_updated_at();

alter table public.units enable row level security;
alter table public.unit_progress enable row level security;
revoke all on public.units, public.unit_progress from anon;
grant select, insert, update, delete on public.units to authenticated;
grant select, insert, update on public.unit_progress to authenticated;

create policy "read published units" on public.units for select to authenticated
  using ((status = 'published' and deleted_at is null) or public.is_staff());
create policy "staff manage units" on public.units for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "own unit progress" on public.unit_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
