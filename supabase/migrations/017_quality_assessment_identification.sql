-- Run this once in the Supabase SQL editor, after 016. Safe to run more
-- than once.
--
-- Adds menu item identification to quality_assessments - once a brand's
-- menu items have reference photos (menu_items.reference_image_url),
-- assessCapture is sent those photos alongside the capture and asked which
-- one it matches, before grading against that item's actual build (see
-- lib/quality/prompt.ts's buildIdentifyAndGradePrompt and
-- lib/data/menuItems.ts's getMenuItemReferences). Until reference photos
-- exist, these columns stay null - identification is a no-op, not a
-- separate mode you need to turn on.
--
-- identified_menu_item_id references menu_items with "on delete set null"
-- rather than restrict/cascade - deleting a menu item later shouldn't be
-- blocked by, or silently corrupt, old scoring history that happened to
-- guess it.

alter table quality_assessments
  add column if not exists identified_menu_item_id uuid references menu_items(id) on delete set null,
  -- The model's raw identifiedMenuItem string, kept alongside the resolved
  -- id above even though it's usually redundant with menu_items.name -
  -- covers the "unclear" case and the (should-be-rare) case of the model
  -- naming something that didn't exactly match a candidate, neither of
  -- which leaves anything in identified_menu_item_id to display.
  add column if not exists identified_menu_item_name text,
  add column if not exists identification_confidence text check (identification_confidence in ('high', 'medium', 'low')),
  -- Set once an agent/admin confirms or corrects the identification (a
  -- separate review step from human_verdict above, which is about the
  -- quality score, not the identity guess) - see reviewIdentificationAction.
  add column if not exists identification_reviewed boolean not null default false,
  add column if not exists identification_correct boolean;

-- The update policy from 015 already covers writing these same two columns
-- (identification_reviewed, identification_correct) - no policy change
-- needed, an agent/admin who can update human_verdict can update these too.
