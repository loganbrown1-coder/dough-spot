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

create table if not exists day_parts (
  id text primary key, -- 'A' | 'B' | 'C'
  label text not null,
  start_time text not null,
  end_time text not null
);

create table if not exists captures (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  date date not null,
  day_part_id text not null references day_parts(id),
  sequence int not null,
  image_url text not null,
  captured_at timestamptz not null default now(),
  source text not null default 'manual',
  unique (site_id, date, day_part_id, sequence)
);

-- One row per Supabase Auth user. Exactly one of the scope columns is set,
-- depending on role:
--   super_admin  -> organisation_id, brand_id, site_id all null (sees everything)
--   org_admin    -> organisation_id set (sees every brand/site in that org)
--   ops          -> brand_id set (sees every site under that brand)
--   site_manager -> site_id set (sees that one site)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null, -- 'super_admin' | 'org_admin' | 'ops' | 'site_manager'
  organisation_id uuid references organisations(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  site_id uuid references sites(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_brands_org on brands(organisation_id);
create index if not exists idx_sites_brand on sites(brand_id);
create index if not exists idx_captures_lookup on captures(site_id, date, day_part_id);
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
-- scoping rule only has to be written once.
create or replace function public.accessible_site_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select s.id
  from sites s
  join brands b on b.id = s.brand_id
  where (select role from current_profile()) = 'super_admin'
     or b.organisation_id = (select organisation_id from current_profile())
     or s.brand_id = (select brand_id from current_profile())
     or s.id = (select site_id from current_profile())
$$;

grant execute on function public.accessible_site_ids() to authenticated;

alter table organisations enable row level security;
alter table brands enable row level security;
alter table sites enable row level security;
alter table day_parts enable row level security;
alter table captures enable row level security;
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

-- brands: readable by anyone in that organisation; only super_admin or
-- that org's own org_admin can create/edit brands.
create policy "brands_select" on brands for select using (
  (select role from current_profile()) = 'super_admin'
  or organisation_id = (select organisation_id from current_profile())
);
create policy "brands_insert" on brands for insert with check (
  (select role from current_profile()) = 'super_admin'
  or (
    (select role from current_profile()) = 'org_admin'
    and organisation_id = (select organisation_id from current_profile())
  )
);
create policy "brands_update" on brands for update using (
  (select role from current_profile()) = 'super_admin'
  or (
    (select role from current_profile()) = 'org_admin'
    and organisation_id = (select organisation_id from current_profile())
  )
);

-- sites: readable/writable by anyone whose scope covers that site
-- (see accessible_site_ids), but only super_admin or the owning org's
-- org_admin can create new sites.
create policy "sites_select" on sites for select using (
  id in (select accessible_site_ids())
);
create policy "sites_insert" on sites for insert with check (
  (select role from current_profile()) = 'super_admin'
  or (
    (select role from current_profile()) = 'org_admin'
    and brand_id in (
      select id from brands where organisation_id = (select organisation_id from current_profile())
    )
  )
);
create policy "sites_update" on sites for update using (
  (select role from current_profile()) = 'super_admin'
  or (
    (select role from current_profile()) = 'org_admin'
    and brand_id in (
      select id from brands where organisation_id = (select organisation_id from current_profile())
    )
  )
);

-- day_parts: fixed global reference data, readable by any signed-in user.
create policy "day_parts_select" on day_parts for select using (auth.uid() is not null);

-- captures: same scoping as sites, both for viewing and for the manual
-- upload flow (a site_manager may only write captures for their own site,
-- an ops user for any site in their brand, and so on).
create policy "captures_select" on captures for select using (
  site_id in (select accessible_site_ids())
);
create policy "captures_insert" on captures for insert with check (
  site_id in (select accessible_site_ids())
);
create policy "captures_delete" on captures for delete using (
  site_id in (select accessible_site_ids())
);

-- profiles: a user can always read their own row; org_admin can read
-- everyone in their org; super_admin can read everyone. Writes are only
-- ever performed by the server using the service-role key (paired with
-- the Supabase Auth admin API when inviting a user), so no INSERT/UPDATE
-- policy is needed here - RLS defaults to deny, which is the safe default
-- for a table that stores role/scope.
create policy "profiles_select" on profiles for select using (
  id = auth.uid()
  or (select role from current_profile()) = 'super_admin'
  or (
    (select role from current_profile()) = 'org_admin'
    and organisation_id = (select organisation_id from current_profile())
  )
);

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
-- Public storage bucket for captured photos. Uploads are written from the
-- server using the service-role key (which bypasses storage policies),
-- gated by the same accessible-site check as the captures table above,
-- enforced in lib/actions/captures.ts before any file is written. The
-- bucket is public so the dashboard can render photos with plain
-- <img src> URLs.
insert into storage.buckets (id, name, public)
values ('captures', 'captures', true)
on conflict (id) do nothing;
