-- Mistake notebook + spaced review (SPEC 5A.5). One row per learner and question they got wrong.
-- Box 0 = just missed (due now). Each correct review moves it up a box with a longer wait (1, 3, 7, 14 days);
-- a correct answer in box 4 marks it mastered. A wrong review sends it back to box 0, due tomorrow.

alter type public.practice_mode add value if not exists 'review';

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  box smallint not null default 0 check (box between 0 and 5),
  due_at timestamptz not null default now(),
  wrong_count integer not null default 1 check (wrong_count >= 0),
  last_score numeric(5, 4) check (last_score between 0 and 1),
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);
create index review_items_due_idx on public.review_items (user_id, due_at) where mastered_at is null;

create trigger set_updated_at before update on public.review_items
  for each row execute function public.set_updated_at();

alter table public.review_items enable row level security;
grant select, insert, update, delete on public.review_items to authenticated;
revoke all on public.review_items from anon;

create policy "own review items" on public.review_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
