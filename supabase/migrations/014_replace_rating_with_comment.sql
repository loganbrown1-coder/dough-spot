-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Drops the star rating feature and replaces it with a free-text comment
-- the uploader can attach to a photo at upload time (e.g. explaining why
-- a photo isn't clearer) - distinct from flag_comment, which a viewer
-- attaches to an already-uploaded photo to report a problem with it.
-- enforce_capture_update_columns() (from migration 006) is recreated with
-- `rating` swapped for `comment` in its agent/admin-only column list.

alter table captures drop column if exists rating;
alter table captures add column if not exists comment text;

create or replace function public.enforce_capture_update_columns()
returns trigger
language plpgsql set search_path = public as $$
declare
  caller_role text;
begin
  select role into caller_role from current_profile();

  if caller_role in ('agent', 'super_admin') then
    return new;
  end if;

  if new.site_id is distinct from old.site_id
    or new.date is distinct from old.date
    or new.day_part_id is distinct from old.day_part_id
    or new.sequence is distinct from old.sequence
    or new.image_url is distinct from old.image_url
    or new.captured_at is distinct from old.captured_at
    or new.source is distinct from old.source
    or new.menu_item_id is distinct from old.menu_item_id
    or new.comment is distinct from old.comment
  then
    raise exception 'Only OpSpot agents and admins can change this field.';
  end if;

  if not (old.flagged = false and new.flagged = true) then
    raise exception 'Only OpSpot agents and admins can change a flag''s status.';
  end if;

  new.flagged_by := auth.uid();
  new.flagged_by_email := auth.jwt() ->> 'email';

  return new;
end;
$$;
