-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Three independent changes:
--   1. profiles.disabled - lets an admin deactivate a user (e.g. a site
--      manager who's left) without deleting their history. Checked at
--      login/session time in lib/auth.ts, on top of also banning them in
--      Supabase Auth itself.
--   2. organisations.retention_days - how long a photo is kept before the
--      scheduled purge job deletes it, per organisation. Defaults to 14
--      days; a super_admin can set a longer window for a specific org
--      from the Admin > Organisations tab.
--   3. Both storage buckets become private. Photos are no longer
--      reachable by a bare URL - every read now goes through a
--      short-lived signed URL generated server-side, from lib/data/
--      captures.ts and lib/data/menuItems.ts, using the service-role
--      client against rows already scoped by row level security. The
--      object paths themselves, and the upload/write code in
--      lib/actions/captures.ts, are unchanged.

alter table profiles add column if not exists disabled boolean not null default false;

alter table organisations add column if not exists retention_days integer not null default 14;

alter table menu_items enable row level security;
drop policy if exists "menu_items_update" on menu_items;
create policy "menu_items_update" on menu_items for update using (
  (select role from current_profile()) = 'super_admin'
);

update storage.buckets set public = false where id in ('captures', 'menu-items');
