-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Closes two gaps found in a security review, both stemming from the same
-- root cause: row level security's USING/WITH CHECK clauses can restrict
-- which ROWS a policy allows, but not which COLUMNS within an allowed row -
-- so a couple of intentionally-open policies were relying on the Next.js
-- server actions to enforce the rest. That's fine for the app's own UI, but
-- any signed-in user can also call the Supabase API directly with their own
-- session (e.g. from the browser console), bypassing the server actions
-- entirely. Both fixes below move the missing restriction into the
-- database itself, so it holds regardless of how the request arrives.
--
-- 1. captures_update let anyone who can see a site's captures (including a
--    customer - ops/site_manager) change ANY column, not just the flag
--    columns they're meant to be limited to - so a customer could directly
--    rewrite a photo's image_url, rating, or menu_item_id, or attribute a
--    flag to someone else by setting flagged_by_email to an arbitrary
--    string. A trigger now enforces this at write time.
--
-- 2. capture_events_insert let anyone insert an audit-log row with any
--    actor_id/actor_email, not just their own - so a customer could forge
--    an entry attributed to someone else. The policy now requires the
--    inserted actor to match the caller.

create or replace function public.enforce_capture_update_columns()
returns trigger
language plpgsql set search_path = public as $$
declare
  caller_role text;
begin
  select role into caller_role from current_profile();

  -- OpSpot's own accounts keep full write access, matching
  -- canManageCaptures() in lib/auth.ts.
  if caller_role in ('agent', 'super_admin') then
    return new;
  end if;

  -- Everyone else (ops, site_manager) may only ever touch the flag
  -- columns below - anything else changing is rejected outright.
  if new.site_id is distinct from old.site_id
    or new.date is distinct from old.date
    or new.day_part_id is distinct from old.day_part_id
    or new.sequence is distinct from old.sequence
    or new.image_url is distinct from old.image_url
    or new.captured_at is distinct from old.captured_at
    or new.source is distinct from old.source
    or new.menu_item_id is distinct from old.menu_item_id
    or new.rating is distinct from old.rating
  then
    raise exception 'Only OpSpot agents and admins can change this field.';
  end if;

  -- A customer's update must be exactly "raise a brand-new flag" (false
  -- -> true) - never resolving one, re-flagging an already-flagged photo,
  -- or editing an existing flag's comment. Resolving is agent/super_admin
  -- only (see resolveFlagAction); everything else about an already-
  -- flagged row is off limits to a customer too, so a second customer
  -- sharing the same brand scope can't overwrite someone else's flag.
  if not (old.flagged = false and new.flagged = true) then
    raise exception 'Only OpSpot agents and admins can change a flag''s status.';
  end if;

  -- Force the flagger's identity to the caller's own real session,
  -- regardless of what flagged_by/flagged_by_email they attempt to
  -- submit - closes off attributing a flag to someone else.
  new.flagged_by := auth.uid();
  new.flagged_by_email := auth.jwt() ->> 'email';

  return new;
end;
$$;

drop trigger if exists trg_enforce_capture_update_columns on captures;
create trigger trg_enforce_capture_update_columns
  before update on captures
  for each row
  execute function public.enforce_capture_update_columns();

drop policy if exists "capture_events_insert" on capture_events;
create policy "capture_events_insert" on capture_events for insert with check (
  site_id in (select accessible_site_ids())
  and actor_id = auth.uid()
  and actor_email = (auth.jwt() ->> 'email')
);
