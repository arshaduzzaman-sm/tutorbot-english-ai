-- Row-Level Security on every table (SPEC 3.1.4). FastAPI runs each request as
-- the `authenticated` role with the user's JWT claims, so these policies apply
-- to API traffic too, not only to direct Supabase access.

alter table public.learning_levels enable row level security;
alter table public.question_categories enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_sections enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.attempts enable row level security;
alter table public.learning_progress enable row level security;
alter table public.test_sessions enable row level security;
alter table public.consents enable row level security;
alter table public.ai_usage enable row level security;
alter table public.audit_log enable row level security;

-- Tighten default grants: anonymous users can only read public reference data.
revoke all on all tables in schema public from anon;
grant select on public.learning_levels, public.question_categories to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.learning_levels, public.question_categories from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.user_roles from authenticated;
revoke update, delete on public.attempts, public.consents, public.ai_usage from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

-- Reference data: readable by everyone.
create policy "levels are public" on public.learning_levels for select to anon, authenticated using (true);
create policy "categories are public" on public.question_categories for select to anon, authenticated using (true);

-- Profiles: own row; staff can read all.
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Roles: own roles readable; admins read all.
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role('admin'));

-- Content: learners see published content; staff see and manage everything.
create policy "read published lessons" on public.lessons for select to authenticated
  using ((status = 'published' and deleted_at is null) or public.is_staff());
create policy "staff manage lessons" on public.lessons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "read sections of published lessons" on public.lesson_sections for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id
                 and ((l.status = 'published' and l.deleted_at is null) or public.is_staff())));
create policy "staff manage sections" on public.lesson_sections for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "read published questions" on public.questions for select to authenticated
  using ((status = 'published' and deleted_at is null) or public.is_staff());
create policy "staff manage questions" on public.questions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "read options of published questions" on public.question_options for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id
                 and ((q.status = 'published' and q.deleted_at is null) or public.is_staff())));
create policy "staff manage options" on public.question_options for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Learner activity: strictly own rows.
create policy "own attempts read" on public.attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own attempts insert" on public.attempts for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "own progress" on public.learning_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own test sessions" on public.test_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own consents read" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own consents insert" on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "own ai usage read" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own ai usage insert" on public.ai_usage for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "admins read audit log" on public.audit_log for select to authenticated
  using (public.has_role('admin'));
