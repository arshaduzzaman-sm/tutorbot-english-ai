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
grant select, insert, delete on public.tutor_messages to authenticated;
create policy "own tutor messages read" on public.tutor_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own tutor messages insert" on public.tutor_messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own tutor messages delete" on public.tutor_messages for delete to authenticated
  using (user_id = (select auth.uid()));
