-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- Records the actual token usage of each scoring call, so the app can
-- enforce a monthly spend cap on quality scoring (see
-- lib/data/qualityAssessments.ts#getQualityScoringSpendThisMonth) without
-- depending on the Anthropic Console's workspace spend limits, which
-- aren't available on prepaid-credit accounts.

alter table quality_assessments
  add column if not exists input_tokens integer not null default 0,
  add column if not exists output_tokens integer not null default 0;
