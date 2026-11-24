-- Vocabulary and pronunciation tracks (SPEC 5A.1).
-- Vocabulary: word sets per level; each learner's flashcards use the same spaced-review boxes as the
-- mistake notebook (box 0 = new/missed, 1-4 = waiting 1, 3, 7, 14 days, 5 = mastered).
-- Pronunciation: topics (sounds, stress, linking, intonation) with listen-and-choose drills; drill answers
-- are only read by the API. Listen-and-repeat checks with the pronunciation analyser arrive in M3.

create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  learning_level_id uuid not null references public.learning_levels (id),
  set_slug text not null,
  set_title text not null,
  set_order smallint not null default 0,
  sort_order smallint not null default 0,
  word text not null,
  part_of_speech text not null,
  meaning text not null,
  example text not null,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vocabulary_set_idx on public.vocabulary (set_slug, sort_order);
create index vocabulary_level_idx on public.vocabulary (learning_level_id, set_order);

create table public.vocabulary_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary (id) on delete cascade,
  box smallint not null default 0 check (box between 0 and 5),
  due_at timestamptz not null default now(),
  times_seen integer not null default 1 check (times_seen > 0),
  times_known integer not null default 0 check (times_known >= 0),
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vocabulary_id)
);
create index vocabulary_reviews_due_idx on public.vocabulary_reviews (user_id, due_at) where mastered_at is null;

create table public.pronunciation_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('vowel', 'diphthong', 'consonant', 'stress', 'linking', 'intonation')),
  title text not null,
  symbols text[] not null default '{}',
  tip text not null,
  examples text[] not null default '{}',
  drill jsonb not null default '[]'::jsonb, -- includes answers: only the API marks them
  sort_order smallint not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pronunciation_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.pronunciation_topics (id) on delete cascade,
  best_score numeric(5, 4) not null check (best_score between 0 and 1),
  attempts integer not null default 1 check (attempts > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

create trigger set_updated_at before update on public.vocabulary
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.vocabulary_reviews
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pronunciation_topics
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pronunciation_progress
  for each row execute function public.set_updated_at();

alter table public.vocabulary enable row level security;
alter table public.vocabulary_reviews enable row level security;
alter table public.pronunciation_topics enable row level security;
alter table public.pronunciation_progress enable row level security;
revoke all on public.vocabulary, public.vocabulary_reviews, public.pronunciation_topics, public.pronunciation_progress from anon;
grant select, insert, update, delete on public.vocabulary, public.pronunciation_topics to authenticated;
grant select, insert, update, delete on public.vocabulary_reviews to authenticated;
grant select, insert, update on public.pronunciation_progress to authenticated;

create policy "read published vocabulary" on public.vocabulary for select to authenticated
  using (status = 'published' or public.is_staff());
create policy "staff manage vocabulary" on public.vocabulary for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "own vocabulary reviews" on public.vocabulary_reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "read published pronunciation" on public.pronunciation_topics for select to authenticated
  using (status = 'published' or public.is_staff());
create policy "staff manage pronunciation" on public.pronunciation_topics for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "own pronunciation progress" on public.pronunciation_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
