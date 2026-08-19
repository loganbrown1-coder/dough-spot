-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once (create table/
-- policy use if-not-exists / drop-if-exists guards below).
--
-- Automated pizza quality scoring (Claude vision) against Fireaway's "Taste
-- or Waste" grading guide. One row per capture per scoring run, kept as
-- history rather than overwritten in place, so re-scoring later (e.g. after
-- a prompt change) doesn't lose earlier calls. See
-- docs/pizza-quality-scoring.md for the full rubric and prompt this backs.
--
-- Written via the service-role client only, from a background job kicked
-- off in lib/actions/captures.ts right after a photo is saved - not a
-- user-initiated write - so there's deliberately no insert policy for the
-- RLS-scoped client, same pattern as Storage writes elsewhere in this app.
-- Reads go through RLS as normal: anyone who can already see a capture can
-- see its quality assessments.

create table if not exists quality_assessments (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references captures(id) on delete cascade,
  model text not null,
  spec_score smallint not null check (spec_score between 1 and 5),
  spec_defects text[] not null default '{}',
  spec_notes text not null default '',
  neat_score smallint not null check (neat_score between 1 and 5),
  neat_defects text[] not null default '{}',
  neat_notes text not null default '',
  heat_score smallint not null check (heat_score between 1 and 5),
  heat_defects text[] not null default '{}',
  heat_notes text not null default '',
  stretch_score smallint not null check (stretch_score between 1 and 5),
  stretch_defects text[] not null default '{}',
  stretch_notes text not null default '',
  overall_score smallint not null check (overall_score between 1 and 5),
  verdict text not null check (verdict in ('pass', 'fail', 'borderline')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  summary text not null,
  -- Set once an agent/admin confirms or corrects the model's call - this is
  -- the training signal for tightening the prompt (or eventually
  -- fine-tuning) later. Everything else on the row only ever comes from the
  -- model itself.
  human_reviewed boolean not null default false,
  human_verdict text check (human_verdict in ('pass', 'fail', 'borderline')),
  created_at timestamptz not null default now()
);

create index if not exists quality_assessments_capture_id_idx
  on quality_assessments(capture_id);

alter table quality_assessments enable row level security;

drop policy if exists "quality_assessments_select" on quality_assessments;
create policy "quality_assessments_select" on quality_assessments for select using (
  capture_id in (select id from captures where site_id in (select accessible_site_ids()))
);

drop policy if exists "quality_assessments_update" on quality_assessments;
create policy "quality_assessments_update" on quality_assessments for update using (
  capture_id in (select id from captures where site_id in (select accessible_site_ids()))
  and (select role from current_profile()) in ('agent', 'super_admin')
) with check (
  capture_id in (select id from captures where site_id in (select accessible_site_ids()))
  and (select role from current_profile()) in ('agent', 'super_admin')
);

-- No insert/delete policy for the RLS-scoped client - rows are written only
-- by the service-role client (the scoring job) and removed only via
-- captures' own on-delete-cascade above.
