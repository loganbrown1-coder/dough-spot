-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Lets an assessment explicitly say "the photo wasn't good enough to judge"
-- instead of the model inventing a plausible-sounding score for a pizza it
-- can't actually see - see JUDGING_GROUND_RULES in lib/quality/prompt.ts.

alter table quality_assessments
  add column if not exists insufficient_evidence boolean not null default false;
