-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Restructures roles into two groups:
--   OpSpot side (unrestricted across every organisation):
--     super_admin - full admin, same as today
--     agent       - new role. Uploads, replaces, deletes, and rates
--                   photos for any customer. Cannot manage brands,
--                   sites, menu items, or users.
--   Customer side (scoped to their own site/brand, same as today):
--     ops           - view-only, plus can flag a photo with a comment
--     site_manager  - view-only, plus can flag a photo with a comment
--
-- org_admin is retired - customers no longer get an admin tier of their
-- own; OpSpot (super_admin/agent) handles all setup. This migration does
-- NOT touch existing profiles rows with role = 'org_admin' (that's a
-- real access change for a real account, not something to do silently).
-- See the bottom of this file for what to run once you've decided what
-- those accounts should become.

-- ---------------------------------------------------------------------
-- agent gets the same "unrestricted" treatment super_admin already has
-- in these two helper functions - every other policy in the app is
-- built on top of them, so this one change is what makes an agent able
-- to see/write every site without touching every policy individually.
-- ---------------------------------------------------------------------
create or replace function public.accessible_site_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select s.id
  from sites s
  join brands b on b.id = s.brand_id
  where (select role from current_profile()) in ('super_admin', 'agent')
     or b.organisation_id = (select organisation_id from current_profile())
     or s.brand_id = (select brand_id from current_profile())
     or s.id = (select site_id from current_profile())
$$;

create or replace function public.accessible_brand_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select b.id
  from brands b
  where (select role from current_profile()) in ('super_admin', 'agent')
     or b.organisation_id = (select organisation_id from current_profile())
     or b.id = (select brand_id from current_profile())
     or b.id in (
       select s.brand_id from sites s where s.id = (select site_id from current_profile())
     )
$$;

-- ---------------------------------------------------------------------
-- Structure management (brands/sites/menu items) is now super_admin
-- only - org_admin no longer gets a write policy of its own.
-- ---------------------------------------------------------------------
drop policy if exists "brands_insert" on brands;
create policy "brands_insert" on brands for insert with check (
  (select role from current_profile()) = 'super_admin'
);

drop policy if exists "brands_update" on brands;
create policy "brands_update" on brands for update using (
  (select role from current_profile()) = 'super_admin'
);

drop policy if exists "sites_insert" on sites;
create policy "sites_insert" on sites for insert with check (
  (select role from current_profile()) = 'super_admin'
);

drop policy if exists "sites_update" on sites;
create policy "sites_update" on sites for update using (
  (select role from current_profile()) = 'super_admin'
);

drop policy if exists "menu_items_insert" on menu_items;
create policy "menu_items_insert" on menu_items for insert with check (
  (select role from current_profile()) = 'super_admin'
);

-- profiles: with no customer-side admin tier, only a user's own row and
-- super_admin's view-everything need a policy.
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (
  id = auth.uid()
  or (select role from current_profile()) = 'super_admin'
);

-- ---------------------------------------------------------------------
-- captures: uploading/replacing/deleting is now agent/super_admin only.
-- captures_update stays open to anyone who can see the row (ops/
-- site_manager need it to set the flag columns) - which columns each
-- role is actually allowed to touch is enforced in the server actions
-- (lib/actions/captures.ts), since row level security can't restrict
-- individual columns.
-- ---------------------------------------------------------------------
drop policy if exists "captures_insert" on captures;
create policy "captures_insert" on captures for insert with check (
  site_id in (select accessible_site_ids())
  and (select role from current_profile()) in ('agent', 'super_admin')
);

drop policy if exists "captures_delete" on captures;
create policy "captures_delete" on captures for delete using (
  site_id in (select accessible_site_ids())
  and (select role from current_profile()) in ('agent', 'super_admin')
);

-- ---------------------------------------------------------------------
-- Flagging: a customer (ops/site_manager) can flag a photo with a note
-- - e.g. "tagged as Pepperoni but it's actually Margherita" - for an
-- agent to review and resolve.
-- ---------------------------------------------------------------------
alter table captures add column if not exists flagged boolean not null default false;
alter table captures add column if not exists flag_comment text;
alter table captures add column if not exists flagged_by uuid references profiles(id) on delete set null;
alter table captures add column if not exists flagged_at timestamptz;

-- ---------------------------------------------------------------------
-- capture_events: append-only audit log. Every upload, replace, delete,
-- clear-all, rating change, flag, and resolve writes a row here so an
-- admin can open a site + date and see who did what, when.
-- ---------------------------------------------------------------------
create table if not exists capture_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  date date not null,
  day_part_id text not null references day_parts(id),
  sequence int not null,
  capture_id uuid references captures(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  actor_email text not null,
  action text not null, -- 'upload' | 'replace' | 'delete' | 'clear_day_part' | 'rate' | 'flag' | 'resolve_flag'
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_capture_events_lookup
  on capture_events(site_id, date, created_at desc);

alter table capture_events enable row level security;

create policy "capture_events_select" on capture_events for select using (
  (select role from current_profile()) = 'super_admin'
);

create policy "capture_events_insert" on capture_events for insert with check (
  site_id in (select accessible_site_ids())
);

-- ---------------------------------------------------------------------
-- What to do about existing org_admin accounts (this project currently
-- has admin@fireaway.test and admin@wildfiregrill.test). Nothing above
-- changes their role - they'll just find every admin/write action now
-- denied by RLS until you reassign them. Pick whichever fits and run it
-- in the SQL editor:
--
--   -- Make an existing org_admin OpSpot's own admin (e.g. your own account):
--   update profiles set role = 'super_admin', organisation_id = null, brand_id = null, site_id = null
--   where email = 'admin@fireaway.test';
--
--   -- Or demote them to a view-only customer role instead, e.g. ops
--   -- (brand-scoped) - replace <brand-id> with the real brand's id:
--   update profiles set role = 'ops', organisation_id = null, brand_id = '<brand-id>'
--   where email = 'admin@fireaway.test';
-- ---------------------------------------------------------------------
