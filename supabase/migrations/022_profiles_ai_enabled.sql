-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Per-user switch for whether a login can see the AI quality scoring at
-- all (score badges, the Rankings view, the AI's menu item guess) - set
-- from Admin > Users, enforced here in the database as well as in the UI.
--
-- Until now AI visibility was tied to role: only agent/super_admin could
-- read quality_assessments. This makes it an explicit per-user flag
-- instead, so a specific customer login can be given (or an OpSpot login
-- denied) access without changing anyone's role. Tenant scoping is
-- unchanged: even with the flag on, a user only ever sees assessments for
-- photos at sites they can already see.
--
-- profiles still has no insert/update policy for regular sessions - only
-- the service-role client can write it - so a user cannot switch this on
-- for themselves through the API.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'ai_enabled'
  ) then
    alter table profiles add column ai_enabled boolean not null default false;
    -- Keep today's behaviour for OpSpot's own accounts, who could always
    -- see AI data. Only runs the first time the column is added, so
    -- re-running this later never switches someone back on.
    update profiles set ai_enabled = true where role in ('agent', 'super_admin');
  end if;
end $$;

-- Deliberately left at the default VOLATILE (not STABLE) - see migration
-- 010 for why a STABLE helper that reads a table other policies depend on
-- can misbehave inside RLS checks.
create or replace function public.current_user_ai_enabled()
returns boolean
language sql security definer set search_path = public as $$
  select coalesce((select ai_enabled from profiles where id = auth.uid()), false)
$$;

grant execute on function public.current_user_ai_enabled() to authenticated;

drop policy if exists "quality_assessments_select" on quality_assessments;
create policy "quality_assessments_select" on quality_assessments for select using (
  capture_id in (select id from captures where site_id in (select accessible_site_ids()))
  and public.current_user_ai_enabled()
);

-- Reviewing (confirm/correct a verdict) stays OpSpot-only, and now also
-- needs the flag - someone with AI switched off can't read these rows to
-- review them either.
drop policy if exists "quality_assessments_update" on quality_assessments;
create policy "quality_assessments_update" on quality_assessments for update using (
  capture_id in (select id from captures where site_id in (select accessible_site_ids()))
  and (select role from current_profile()) in ('agent', 'super_admin')
  and public.current_user_ai_enabled()
) with check (
  capture_id in (select id from captures where site_id in (select accessible_site_ids()))
  and (select role from current_profile()) in ('agent', 'super_admin')
  and public.current_user_ai_enabled()
);
