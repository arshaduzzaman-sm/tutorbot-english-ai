-- PTE Master AI: Milestone 1 core schema.
-- This folder is the single source of truth for the database schema (SPEC 3.1.1).

-- ---------- Types ----------
create type public.app_role as enum ('student', 'content_editor', 'admin');
create type public.content_status as enum ('draft', 'ai_generated', 'reviewed', 'published');
create type public.difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.skill as enum ('speaking', 'writing', 'reading', 'listening');
create type public.pte_section as enum ('speaking_writing', 'reading', 'listening');
create type public.practice_mode as enum ('learn', 'practice', 'timed_drill', 'exam');

-- ---------- Helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Reference data ----------
create table public.learning_levels (
  id uuid primary key default gen_random_uuid(),
  code smallint not null unique check (code between 1 and 6),
  slug text not null unique,
  name text not null,
  cefr text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]+$'),
  name text not null,
  section public.pte_section not null,
  skills public.skill[] not null default '{}',
  sort_order smallint not null default 0,
  description text not null default '',
  official_source_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Users ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  learning_level_id uuid references public.learning_levels (id),
  target_score smallint check (target_score between 10 and 90),
  exam_date date,
  daily_goal_minutes smallint not null default 30 check (daily_goal_minutes in (15, 30, 60, 120)),
  locale text not null default 'en' check (char_length(locale) <= 10),
  age_confirmed_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_id_idx on public.user_roles (user_id);

-- ---------- Content ----------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  learning_level_id uuid not null references public.learning_levels (id),
  title text not null,
  summary text not null default '',
  sort_order smallint not null default 0,
  estimated_minutes smallint not null default 10 check (estimated_minutes > 0),
  status public.content_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index lessons_level_idx on public.lessons (learning_level_id, sort_order);

create table public.lesson_sections (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  kind text not null check (kind in ('learn', 'see', 'try', 'check', 'review')),
  sort_order smallint not null default 0,
  title text not null default '',
  body_md text not null default '',
  -- Optional native-language explanations, keyed by locale, e.g. {"bn": "..."} (SPEC 9.3)
  native_explanations jsonb not null default '{}'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lesson_sections_lesson_idx on public.lesson_sections (lesson_id, sort_order);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  category_id uuid not null references public.question_categories (id),
  difficulty public.difficulty not null,
  instructions text not null,
  content jsonb not null default '{}'::jsonb,
  answer jsonb not null default '{}'::jsonb,
  explanation text not null default '',
  learning_objective text not null default '',
  scoring_criteria text[] not null default '{}',
  key_points text[] not null default '{}',
  source text not null default 'original',
  licence text not null default 'CC-BY-SA-4.0',
  author text not null default 'PTE Master AI contributors',
  status public.content_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index questions_category_idx on public.questions (category_id, status);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  body text not null,
  is_correct boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index question_options_question_idx on public.question_options (question_id);

-- ---------- Learner activity ----------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  category_id uuid references public.question_categories (id),
  mode public.practice_mode not null default 'practice',
  is_correct boolean,
  score_ratio numeric(5, 4) check (score_ratio between 0 and 1),
  duration_seconds integer check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  check (question_id is not null or lesson_id is not null)
);
create index attempts_user_created_idx on public.attempts (user_id, created_at desc);

create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  score_ratio numeric(5, 4) check (score_ratio between 0 and 1),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index learning_progress_user_idx on public.learning_progress (user_id);

create table public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('full_mock', 'section_test', 'mini_mock')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  blueprint_version text,
  result_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index test_sessions_user_idx on public.test_sessions (user_id, started_at desc);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'recording', 'cookies_analytics')),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, kind, created_at desc);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  provider text not null check (provider in ('local', 'mock')),
  created_at timestamptz not null default now()
);
create index ai_usage_user_day_idx on public.ai_usage (user_id, feature, created_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['learning_levels','question_categories','profiles','lessons',
    'lesson_sections','questions','learning_progress','test_sessions']
  loop
    execute format('create trigger set_updated_at before update on public.%I
      for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- New user trigger: create profile + student role ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, age_confirmed_at)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''),
    case when (new.raw_user_meta_data ->> 'age_confirmed') = 'true' then now() else null end
  );
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  insert into public.consents (user_id, kind, granted)
  select new.id, 'terms', true
  where (new.raw_user_meta_data ->> 'terms_accepted') = 'true';
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Role helper (used by RLS) ----------
create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = check_role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin') or public.has_role('content_editor');
$$;
