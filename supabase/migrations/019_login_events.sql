-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- One row per successful sign-in, so Admin > Users can show how often each
-- person actually logs in. Append-only, same shape as capture_events:
-- user_id references profiles(id) on delete set null (a removed user's
-- history stays readable rather than disappearing), and the insert policy
-- forces self-attribution the same way capture_events_insert does, so a
-- session can only ever log its own sign-in, never one attributed to
-- someone else.

create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_events_user on login_events(user_id, created_at desc);

alter table login_events enable row level security;

drop policy if exists "login_events_select" on login_events;
create policy "login_events_select" on login_events for select using (
  (select role from current_profile()) = 'super_admin'
);

drop policy if exists "login_events_insert" on login_events;
create policy "login_events_insert" on login_events for insert with check (
  user_id = auth.uid() and email = (auth.jwt() ->> 'email')
);
