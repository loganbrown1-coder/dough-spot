-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Unlike earlier migrations, this one is
-- NOT safe to run twice - it restructures existing data, not just adds a
-- column. It's wrapped in a transaction, so if anything fails partway
-- through, everything rolls back and nothing changes.
--
-- Day parts were a single global table (id 'A'/'B'/'C', shared by every
-- organisation). This makes them per-organisation and freely editable (1-6
-- per org, any label/times) - every existing organisation gets its own
-- copy of the current 3 day parts first, so nothing changes for anyone
-- until an admin actually edits them. Every capture and capture_event is
-- remapped from the old global code to the new org-scoped row, matched
-- via the capture's site -> brand -> organisation.

begin;

-- 0. Migration 006 added a BEFORE UPDATE trigger on captures that checks
--    auth.uid()/current_profile() to decide who's allowed to change what.
--    The SQL editor runs with no Supabase Auth session at all, so that
--    trigger would misread the remap below as an unauthorized flag change
--    and abort this whole migration - disable it for just this
--    transaction (re-enabled before commit), regardless of whether 006
--    has been run yet.
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_enforce_capture_update_columns') then
    alter table captures disable trigger trg_enforce_capture_update_columns;
  end if;
end $$;

-- 1. New per-organisation day_parts table.
create table day_parts_new (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  label text not null,
  start_time text not null,
  end_time text not null
);

-- 2. Give every existing organisation its own copy of the current global
--    day parts. legacy_code is temporary (dropped at the end), used only
--    to remap captures/capture_events below.
alter table day_parts_new add column legacy_code text;

insert into day_parts_new (organisation_id, label, start_time, end_time, legacy_code)
select o.id, dp.label, dp.start_time, dp.end_time, dp.id
from organisations o
cross join day_parts dp;

-- 3. Point every capture and capture_event at its organisation's new row
--    instead of the old global code.
alter table captures add column new_day_part_id uuid;
update captures c
set new_day_part_id = dpn.id
from day_parts_new dpn, sites s, brands b
where s.id = c.site_id
  and b.id = s.brand_id
  and dpn.organisation_id = b.organisation_id
  and dpn.legacy_code = c.day_part_id;

alter table capture_events add column new_day_part_id uuid;
update capture_events ce
set new_day_part_id = dpn.id
from day_parts_new dpn, sites s, brands b
where s.id = ce.site_id
  and b.id = s.brand_id
  and dpn.organisation_id = b.organisation_id
  and dpn.legacy_code = ce.day_part_id;

-- 4. Safety check - abort the whole migration (rolling back everything
--    above) if any row failed to remap, rather than proceeding with data
--    that would silently lose its day part.
do $$
declare
  unmapped_captures int;
  unmapped_events int;
begin
  select count(*) into unmapped_captures from captures where new_day_part_id is null;
  select count(*) into unmapped_events from capture_events where new_day_part_id is null;
  if unmapped_captures > 0 or unmapped_events > 0 then
    raise exception 'Day part remap incomplete: % captures, % capture_events unmapped - aborting, nothing changed.',
      unmapped_captures, unmapped_events;
  end if;
end $$;

-- 5. Swap captures/capture_events onto the new column. CASCADE drops the
--    old unique constraint and index that depended on the old day_part_id
--    column automatically.
alter table captures drop column day_part_id cascade;
alter table captures rename column new_day_part_id to day_part_id;
alter table captures alter column day_part_id set not null;
alter table captures add constraint captures_site_id_date_day_part_id_sequence_key
  unique (site_id, date, day_part_id, sequence);
create index idx_captures_lookup on captures(site_id, date, day_part_id);

alter table capture_events drop column day_part_id cascade;
alter table capture_events rename column new_day_part_id to day_part_id;
alter table capture_events alter column day_part_id set not null;

-- 6. Swap the day_parts table itself.
drop table day_parts;
alter table day_parts_new drop column legacy_code;
alter table day_parts_new rename to day_parts;
create index idx_day_parts_org on day_parts(organisation_id);

-- 7. Foreign keys from captures/capture_events to the new day_parts.
alter table captures add constraint captures_day_part_id_fkey
  foreign key (day_part_id) references day_parts(id) on delete restrict;
alter table capture_events add constraint capture_events_day_part_id_fkey
  foreign key (day_part_id) references day_parts(id) on delete restrict;
-- "on delete restrict" means a day part with any photos against it can't
-- be deleted at all (the app surfaces this as a friendly error rather
-- than letting an admin accidentally destroy history) - see
-- deleteDayPartAction in lib/actions/admin.ts.

-- 8. RLS: day_parts is now organisation-scoped like brands/sites, not
--    "readable by any signed-in user". accessible_organisation_ids()
--    mirrors accessible_site_ids()/accessible_brand_ids() in schema.sql.
create or replace function public.accessible_organisation_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
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
grant execute on function public.accessible_organisation_ids() to authenticated;

alter table day_parts enable row level security;
drop policy if exists "day_parts_select" on day_parts;
create policy "day_parts_select" on day_parts for select using (
  organisation_id in (select accessible_organisation_ids())
);
create policy "day_parts_insert" on day_parts for insert with check (
  (select role from current_profile()) = 'super_admin'
);
create policy "day_parts_update" on day_parts for update using (
  (select role from current_profile()) = 'super_admin'
);
create policy "day_parts_delete" on day_parts for delete using (
  (select role from current_profile()) = 'super_admin'
);

-- Re-enable the trigger disabled in step 0.
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_enforce_capture_update_columns') then
    alter table captures enable trigger trg_enforce_capture_update_columns;
  end if;
end $$;

commit;
