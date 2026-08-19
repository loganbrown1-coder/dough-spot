-- Run this once in the Supabase SQL editor, after 015_quality_assessments.sql.
-- Safe to run more than once.
--
-- Restricts quality_assessments to OpSpot's own accounts (agent,
-- super_admin) only. The original select policy in 015 mirrored
-- captures_select's scoping, which also lets a customer (ops/site_manager)
-- see rows for sites they're allowed to see - fine for captures themselves,
-- but Fireaway staff shouldn't see the automated quality scores yet. This
-- tightens the policy at the database level rather than only hiding the
-- badge in the UI (see QualityBadge's caller in CaptureTile.tsx) - the same
-- reasoning as 006_capture_write_hardening.sql: a signed-in customer could
-- otherwise call the Supabase API directly with their own session and read
-- the rows regardless of what the app's UI shows them.

drop policy if exists "quality_assessments_select" on quality_assessments;
create policy "quality_assessments_select" on quality_assessments for select using (
  capture_id in (select id from captures where site_id in (select accessible_site_ids()))
  and (select role from current_profile()) in ('agent', 'super_admin')
);
