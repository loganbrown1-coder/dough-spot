-- brands had select/insert/update policies but no delete policy - row
-- level security defaults to deny for any operation with no matching
-- policy, so the new "Remove brand" feature would silently fail without
-- this (same class of gap fixed for sites in migration 008 and
-- capture_events in migration 011). super_admin only, same as every
-- other structural change to brands.
begin;

drop policy if exists "brands_delete" on brands;
create policy "brands_delete" on brands for delete using (
  (select role from current_profile()) = 'super_admin'
);

commit;
