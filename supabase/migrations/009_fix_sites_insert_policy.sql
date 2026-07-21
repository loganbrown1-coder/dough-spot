-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- "Add a site" in Admin > Brands & sites has been failing with "new row
-- violates row-level security policy for table sites" even for
-- super_admin - confirmed by testing directly against the API, not a UI
-- bug. sites_insert/sites_update should already read exactly this (they
-- were rewritten in migration 003), but something left the live policy
-- out of sync with that. This just re-asserts the correct definition -
-- unrelated to the site-deletion feature added alongside it, this was
-- found while testing that.

drop policy if exists "sites_insert" on sites;
create policy "sites_insert" on sites for insert with check (
  (select role from current_profile()) = 'super_admin'
);

drop policy if exists "sites_update" on sites;
create policy "sites_update" on sites for update using (
  (select role from current_profile()) = 'super_admin'
);
