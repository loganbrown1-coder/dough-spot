-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Root cause of "Add site" (and "Add brand") failing with "new row
-- violates row-level security policy": accessible_site_ids() and
-- accessible_brand_ids() are marked STABLE, which tells Postgres their
-- result can be treated as unchanged for the duration of a statement.
-- Both functions query the very table they help gate (accessible_site_ids
-- queries sites, accessible_brand_ids queries brands) - so when an
-- INSERT ... RETURNING needs to RLS-check the row it just wrote, the
-- STABLE function isn't guaranteed to see that brand-new row yet. A bare
-- insert (no representation requested back) works fine; the moment the
-- app asks for the created row back - exactly what .select().single()
-- does after .insert() in the Supabase client - the RLS check on the
-- returned row can fail even though the same call would succeed a moment
-- later as an ordinary read. Removing STABLE (falling back to the
-- default VOLATILE) fixes this - Postgres no longer assumes the result is
-- cacheable across the statement, so it always sees the current state
-- including the statement's own writes.
--
-- current_profile() and accessible_organisation_ids() aren't hit by this
-- specific bug today (profiles and day_parts/organisations aren't
-- self-referenced the same way), but are switched too for consistency and
-- to rule out the same class of bug if their usage ever changes.

create or replace function public.current_profile()
returns table (role text, organisation_id uuid, brand_id uuid, site_id uuid)
language sql security definer set search_path = public as $$
  select role, organisation_id, brand_id, site_id
  from profiles
  where id = auth.uid()
$$;

create or replace function public.accessible_site_ids()
returns setof uuid
language sql security definer set search_path = public as $$
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
language sql security definer set search_path = public as $$
  select b.id
  from brands b
  where (select role from current_profile()) in ('super_admin', 'agent')
     or b.organisation_id = (select organisation_id from current_profile())
     or b.id = (select brand_id from current_profile())
     or b.id in (
       select s.brand_id from sites s where s.id = (select site_id from current_profile())
     )
$$;

create or replace function public.accessible_organisation_ids()
returns setof uuid
language sql security definer set search_path = public as $$
  select o.id
  from organisations o
  where (select role from current_profile()) in ('super_admin', 'agent')
     or o.id in (select organisation_id from brands where id = (select brand_id from current_profile()))
     or o.id in (
       select b.organisation_id from brands b
       join sites s on s.brand_id = b.id
       where s.id = (select site_id from current_profile())
     )
$$;
