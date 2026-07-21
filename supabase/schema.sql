-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- for a freshly created project, before running `npm run seed`.
--
-- This app is multi-tenant: an organisation (e.g. an OpSpot customer) can
-- own multiple brands, each brand owns multiple sites, and every user is
-- scoped to exactly one level of that hierarchy. Authentication is handled
-- entirely by Supabase Auth (auth.users) - this schema only adds the
-- `profiles` row that attaches a role and a scope to each authenticated
-- user, plus row level security policies that enforce tenant isolation in
-- the database itself (not just in application code).

create extension if not exists pgcrypto;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- How many days a photo is kept before the scheduled purge job
  -- (app/api/cron/purge-expired-captures) deletes it. A super_admin can
  -- raise this per organisation from Admin > Organisations.
  retention_days integer not null default 14,
  created_at timestamptz not null default now()
);

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  name text not null
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null
);

-- Configurable per organisation (1-6, any label/times) via Admin > a
-- selected organisation's Brands & sites tab - see lib/actions/admin.ts.
-- A new organisation is seeded with the same 3 default day parts every
-- organisation used to share globally, editable from there afterwards.
create table if not exists day_parts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  label text not null,
  start_time text not null,
  end_time text not null
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  reference_image_url text,
  created_at timestamptz not null default now()
);

create table if not exists captures (
  id uuid primary key default gen_random_uuid(),
  -- "on delete restrict" means a site with any photos against it can't be
  -- deleted - see deleteSiteAction.
  site_id uuid not null references sites(id) on delete restrict,
  date date not null,
  -- "on delete restrict" (the default) means a day part with any photos
  -- against it can't be deleted - see deleteDayPartAction.
  day_part_id uuid not null references day_parts(id),
  sequence int not null,
  image_url text not null,
  captured_at timestamptz not null default now(),
  source text not null default 'manual',
  menu_item_id uuid references menu_items(id),
  rating smallint check (rating is null or rating between 1 and 5),
  -- A customer (ops/site_manager) can flag a photo with a note - e.g. it
  -- was tagged wrong - for an agent to review and resolve. flagged_by_email
  -- is denormalized (same reason as capture_events.actor_email below) - an
  -- agent can't look up another user's email through profiles, since RLS
  -- only lets a non-admin see their own row.
  flagged boolean not null default false,
  flag_comment text,
  flagged_by uuid references profiles(id) on delete set null,
  flagged_by_email text,
  flagged_at timestamptz,
  unique (site_id, date, day_part_id, sequence)
);

-- One row per Supabase Auth user. Exactly one of the scope columns is set,
-- depending on role:
--   super_admin  -> organisation_id, brand_id, site_id all null (OpSpot's
--                   own admin, sees and manages everything)
--   agent        -> organisation_id, brand_id, site_id all null (OpSpot's
--                   own uploader - uploads/replaces/deletes/rates photos
--                   for any customer, but no admin access)
--   ops          -> brand_id set (customer, sees every site under that
--                   brand - view-only, plus can flag a photo)
--   site_manager -> site_id set (customer, sees that one site - view-only,
--                   plus can flag a photo)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null, -- 'super_admin' | 'agent' | 'ops' | 'site_manager'
  organisation_id uuid references organisations(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  -- "on delete restrict" means a site with a user still assigned to it
  -- can't be deleted - reassign or remove that user first.
  site_id uuid references sites(id) on delete restrict,
  -- Set by an admin deactivating a user (e.g. someone who's left) without
  -- deleting their history. Checked at session time in lib/auth.ts, on
  -- top of also being banned in Supabase Auth itself.
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Append-only audit log: every upload, replace, delete, clear-all, rating
-- change, flag, resolve, and scheduled purge writes a row here, so an
-- admin can open a site + date and see who did what, when.
create table if not exists capture_events (
  id uuid primary key default gen_random_uuid(),
  -- "on delete restrict" means a site with audit history against it can't
  -- be deleted, protecting the audit trail the same way captures are.
  site_id uuid not null references sites(id) on delete restrict,
  date date not null,
  day_part_id uuid not null references day_parts(id),
  sequence int not null,
  capture_id uuid references captures(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  actor_email text not null,
  action text not null, -- 'upload' | 'replace' | 'delete' | 'clear_day_part' | 'rate' | 'flag' | 'resolve_flag' | 'purge'
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_brands_org on brands(organisation_id);
create index if not exists idx_menu_items_brand on menu_items(brand_id);
create index if not exists idx_sites_brand on sites(brand_id);
create index if not exists idx_day_parts_org on day_parts(organisation_id);
create index if not exists idx_captures_lookup on captures(site_id, date, day_part_id);
create index if not exists idx_capture_events_lookup on capture_events(site_id, date, created_at desc);
create index if not exists idx_profiles_org on profiles(organisation_id);
create index if not exists idx_profiles_brand on profiles(brand_id);
create index if not exists idx_profiles_site on profiles(site_id);

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
-- current_profile() is SECURITY DEFINER so it can read the caller's own
-- profiles row without recursing back through the profiles RLS policy
-- (a well-known Supabase gotcha: a policy on `profiles` that queries
-- `profiles` directly causes infinite recursion; wrapping the lookup in a
-- definer function sidesteps that).

create or replace function public.current_profile()
returns table (role text, organisation_id uuid, brand_id uuid, site_id uuid)
language sql security definer stable set search_path = public as $$
  select role, organisation_id, brand_id, site_id
  from profiles
  where id = auth.uid()
$$;

grant execute on function public.current_profile() to authenticated;

-- Every site the current user is allowed to see or upload to, given their
-- role and scope. Shared by the sites and captures policies below so the
-- scoping rule only has to be written once. super_admin and agent are
-- both unrestricted (OpSpot's own accounts, not scoped to one customer).
create or replace function public.accessible_site_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select s.id
  from sites s
  join brands b on b.id = s.brand_id
  where (select role from current_profile()) in ('super_admin', 'agent')
     or b.organisation_id = (select organisation_id from current_profile())
     or s.brand_id = (select brand_id from current_profile())
     or s.id = (select site_id from current_profile())
$$;

grant execute on function public.accessible_site_ids() to authenticated;

-- Every brand the current user can see. Same shape as
-- accessible_site_ids() - super_admin/agent see everything, ops via their
-- own brand_id, site_manager via the brand their one site belongs to.
create or replace function public.accessible_brand_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select b.id
  from brands b
  where (select role from current_profile()) in ('super_admin', 'agent')
     or b.organisation_id = (select organisation_id from current_profile())
     or b.id = (select brand_id from current_profile())
     or b.id in (
       select s.brand_id from sites s where s.id = (select site_id from current_profile())
     )
$$;

grant execute on function public.accessible_brand_ids() to authenticated;

-- Every organisation the current user can see. Same shape again - used to
-- scope day_parts, which belong directly to an organisation rather than a
-- brand or site.
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

alter table organisations enable row level security;
alter table brands enable row level security;
alter table menu_items enable row level security;
alter table sites enable row level security;
alter table day_parts enable row level security;
alter table captures enable row level security;
alter table capture_events enable row level security;
alter table profiles enable row level security;

-- organisations: super_admin sees all; everyone else sees only their own.
create policy "organisations_select" on organisations for select using (
  (select role from current_profile()) = 'super_admin'
  or id = (select organisation_id from current_profile())
);
create policy "organisations_insert" on organisations for insert with check (
  (select role from current_profile()) = 'super_admin'
);
create policy "organisations_update" on organisations for update using (
  (select role from current_profile()) = 'super_admin'
);

-- brands: readable by anyone in scope; only super_admin manages
-- structure (customers have no admin tier of their own).
create policy "brands_select" on brands for select using (
  id in (select accessible_brand_ids())
);
create policy "brands_insert" on brands for insert with check (
  (select role from current_profile()) = 'super_admin'
);
create policy "brands_update" on brands for update using (
  (select role from current_profile()) = 'super_admin'
);

-- menu_items: readable by anyone in that brand's scope; only super_admin
-- adds/renames menu items (admin-page only).
create policy "menu_items_select" on menu_items for select using (
  brand_id in (select accessible_brand_ids())
);
create policy "menu_items_insert" on menu_items for insert with check (
  (select role from current_profile()) = 'super_admin'
);
create policy "menu_items_update" on menu_items for update using (
  (select role from current_profile()) = 'super_admin'
);

-- sites: readable/writable by anyone whose scope covers that site
-- (see accessible_site_ids), but only super_admin creates new sites.
create policy "sites_select" on sites for select using (
  id in (select accessible_site_ids())
);
create policy "sites_insert" on sites for insert with check (
  (select role from current_profile()) = 'super_admin'
);
create policy "sites_update" on sites for update using (
  (select role from current_profile()) = 'super_admin'
);
create policy "sites_delete" on sites for delete using (
  (select role from current_profile()) = 'super_admin'
);

-- day_parts: readable by anyone in that organisation's scope; only
-- super_admin adds/edits/removes day parts (admin-page only), same as
-- brands/sites/menu_items.
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

-- captures: viewing follows the same scoping as sites. Uploading,
-- replacing, and deleting is agent/super_admin only - a customer
-- (ops/site_manager) can see a capture but not write a new one or remove
-- it. captures_update stays open to anyone who can see the row, because
-- a customer needs it too (to set the flag columns below); which columns
-- each role may actually touch is enforced in the server actions
-- (lib/actions/captures.ts), since row level security can't restrict
-- individual columns.
create policy "captures_select" on captures for select using (
  site_id in (select accessible_site_ids())
);
create policy "captures_insert" on captures for insert with check (
  site_id in (select accessible_site_ids())
  and (select role from current_profile()) in ('agent', 'super_admin')
);
create policy "captures_delete" on captures for delete using (
  site_id in (select accessible_site_ids())
  and (select role from current_profile()) in ('agent', 'super_admin')
);
create policy "captures_update" on captures for update using (
  site_id in (select accessible_site_ids())
);

-- captures_update above is intentionally row-scoped only (row level
-- security can't restrict individual columns) - this trigger is the
-- column-level enforcement it depends on. A customer (ops/site_manager)
-- may only ever touch the flag columns, and only to raise a brand-new
-- flag (false -> true) - never resolving one, re-flagging an already-
-- flagged photo, or editing an existing flag (all agent/super_admin
-- only, see resolveFlagAction). They also can't attribute a flag to
-- anyone but themselves - flagged_by/flagged_by_email are forced to
-- their own session regardless of what they submit. Without this, a
-- customer could bypass the server actions entirely by calling the
-- Supabase API directly with their own session and rewrite any column.
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
    or new.rating is distinct from old.rating
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

drop trigger if exists trg_enforce_capture_update_columns on captures;
create trigger trg_enforce_capture_update_columns
  before update on captures
  for each row
  execute function public.enforce_capture_update_columns();

-- capture_events: an append-only audit trail, so an admin can open a
-- site + date and see who uploaded/replaced/deleted/flagged what, and
-- when. Only super_admin can read it; anyone who can act on a capture
-- can write an event about that action, but only attributed to
-- themselves - actor_id/actor_email must match the caller, so a customer
-- can't forge an entry blaming someone else for an action.
create policy "capture_events_select" on capture_events for select using (
  (select role from current_profile()) = 'super_admin'
);
create policy "capture_events_insert" on capture_events for insert with check (
  site_id in (select accessible_site_ids())
  and actor_id = auth.uid()
  and actor_email = (auth.jwt() ->> 'email')
);

-- profiles: a user can always read their own row; super_admin can read
-- everyone (there's no customer-side admin tier to also grant this to).
-- Writes are only ever performed by the server using the service-role key
-- (paired with the Supabase Auth admin API when inviting a user), so no
-- INSERT/UPDATE policy is needed here - RLS defaults to deny, which is
-- the safe default for a table that stores role/scope.
create policy "profiles_select" on profiles for select using (
  id = auth.uid()
  or (select role from current_profile()) = 'super_admin'
);

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
-- Private storage bucket for captured photos. Uploads are written from
-- the server using the service-role key (which bypasses storage
-- policies), gated by the same accessible-site check as the captures
-- table above, enforced in lib/actions/captures.ts before any file is
-- written. The bucket is private - there is no bare URL that serves a
-- photo. Every read goes through a short-lived signed URL, generated
-- server-side (also via the service-role key) in lib/data/captures.ts,
-- for rows already scoped by the captures_select row level security
-- policy - so signing never bypasses who's allowed to see a photo, only
-- how the browser fetches the one they're already allowed to see.
insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do update set public = false;

-- Private storage bucket for menu item reference photos - same signed-URL
-- treatment, from lib/data/menuItems.ts.
insert into storage.buckets (id, name, public)
values ('menu-items', 'menu-items', false)
on conflict (id) do update set public = false;
