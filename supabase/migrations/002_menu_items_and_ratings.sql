-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.

-- ---------------------------------------------------------------------
-- Menu items (brand-scoped, with a reference photo of what the dish
-- should look like)
-- ---------------------------------------------------------------------
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  reference_image_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_items_brand on menu_items(brand_id);

alter table captures add column if not exists menu_item_id uuid references menu_items(id);
alter table captures add column if not exists rating smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'captures_rating_check'
  ) then
    alter table captures
      add constraint captures_rating_check check (rating is null or rating between 1 and 5);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- accessible_brand_ids(): every brand the current user can see. Same
-- shape as accessible_site_ids() in schema.sql. This also fixes a gap
-- in the original brands_select policy, which only checked
-- organisation_id and so never matched ops/site_manager profiles (they
-- carry brand_id/site_id instead) - they could see their sites but not
-- the brand row those sites belong to.
-- ---------------------------------------------------------------------
create or replace function public.accessible_brand_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select b.id
  from brands b
  where (select role from current_profile()) = 'super_admin'
     or b.organisation_id = (select organisation_id from current_profile())
     or b.id = (select brand_id from current_profile())
     or b.id in (
       select s.brand_id from sites s where s.id = (select site_id from current_profile())
     )
$$;

grant execute on function public.accessible_brand_ids() to authenticated;

drop policy if exists "brands_select" on brands;
create policy "brands_select" on brands for select using (
  id in (select accessible_brand_ids())
);

alter table menu_items enable row level security;

create policy "menu_items_select" on menu_items for select using (
  brand_id in (select accessible_brand_ids())
);
create policy "menu_items_insert" on menu_items for insert with check (
  (select role from current_profile()) = 'super_admin'
  or (
    (select role from current_profile()) = 'org_admin'
    and brand_id in (
      select id from brands where organisation_id = (select organisation_id from current_profile())
    )
  )
);

-- captures_update: needed for the star rating (anyone who can see a
-- photo can rate it, same scoping as viewing/uploading it).
create policy "captures_update" on captures for update using (
  site_id in (select accessible_site_ids())
);

-- Public storage bucket for menu item reference photos.
insert into storage.buckets (id, name, public)
values ('menu-items', 'menu-items', true)
on conflict (id) do nothing;
