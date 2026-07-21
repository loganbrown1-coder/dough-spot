-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- capture_events had no delete policy at all - RLS defaults to deny for
-- any operation without a matching policy, so the force-delete-a-site
-- feature's attempt to clear a site's audit history silently matched zero
-- rows instead of actually deleting anything. Those undeleted rows then
-- blocked the site itself from being deleted (capture_events.site_id is
-- "on delete restrict"), surfacing as a generic "Failed to delete site."
-- error. Adds a super_admin-only delete policy - capture_events stays
-- append-only for everyone else, this only enables the one legitimate
-- case (forceDeleteSiteAction).

drop policy if exists "capture_events_delete" on capture_events;
create policy "capture_events_delete" on capture_events for delete using (
  (select role from current_profile()) = 'super_admin'
);
