-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- captures.flagged_by is a profile id, but an agent can't look up another
-- user's email through profiles (RLS only lets a non-admin see their own
-- row - see profiles_select in schema.sql) - so the /flags inbox has no
-- way to show who raised a flag without this. Denormalizing the email at
-- flag time matches the same pattern already used for
-- capture_events.actor_email.

alter table captures add column if not exists flagged_by_email text;
