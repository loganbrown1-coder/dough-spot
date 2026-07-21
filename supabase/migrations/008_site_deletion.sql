-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Adds the ability to delete a site from Admin > Brands & sites. Three
-- foreign keys currently point at sites(id) with "on delete cascade" -
-- captures.site_id, capture_events.site_id, profiles.site_id - meaning a
-- site delete would silently wipe every photo, the entire audit history,
-- and orphan any user still scoped to that site (their Supabase Auth
-- account would survive with no profile row, locking them out with no
-- visible reason). This switches all three to "on delete restrict": the
-- database itself now refuses to delete a site that still has photos,
-- audit history, or an assigned user, regardless of whether the request
-- comes through the app or a direct API call. deleteSiteAction in
-- lib/actions/admin.ts checks for these ahead of time to give a clear
-- error instead of the raw constraint violation.

do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where rel.relname = 'captures' and con.contype = 'f' and att.attname = 'site_id';
  execute format('alter table captures drop constraint %I', fk_name);
end $$;
alter table captures add constraint captures_site_id_fkey
  foreign key (site_id) references sites(id) on delete restrict;

do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where rel.relname = 'capture_events' and con.contype = 'f' and att.attname = 'site_id';
  execute format('alter table capture_events drop constraint %I', fk_name);
end $$;
alter table capture_events add constraint capture_events_site_id_fkey
  foreign key (site_id) references sites(id) on delete restrict;

do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where rel.relname = 'profiles' and con.contype = 'f' and att.attname = 'site_id';
  execute format('alter table profiles drop constraint %I', fk_name);
end $$;
alter table profiles add constraint profiles_site_id_fkey
  foreign key (site_id) references sites(id) on delete restrict;

-- No delete policy existed on sites at all (RLS defaults to deny), since
-- there was previously no way to delete one from the app.
drop policy if exists "sites_delete" on sites;
create policy "sites_delete" on sites for delete using (
  (select role from current_profile()) = 'super_admin'
);
