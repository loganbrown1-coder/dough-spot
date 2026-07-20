# Dough Spot

A multi-tenant dashboard for viewing daily site photos by organisation,
brand, site, date, and day part, plus a manual upload page that replaces
the old PDF-and-email workflow. Camera automation is a separate workstream;
this app is the destination that automation will eventually feed into
directly.

Backed by Supabase (Postgres, Auth, Storage), deployable to Vercel. Every
organisation's data is isolated by Postgres row level security, not just
application code - see [How access control works](#how-access-control-works)
below.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**. Free tier is fine.
2. Once it's provisioned, open **SQL Editor > New query**, paste in the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates every table, the row level security policies, and the (private) `captures` and `menu-items` storage buckets.
3. Open **Authentication > Providers** and make sure **Email** is enabled (it is by default).
4. Open **Authentication > URL Configuration**:
   - **Site URL**: `http://localhost:3000` for now (change this to your Vercel URL once deployed).
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` (and later your Vercel URL's `/auth/callback` too). This is where invite emails send people to finish setting up their account.
5. Open **Project Settings > API**. You'll need three values from this page:
   - **Project URL**
   - **anon** / **public** key
   - **service_role** key

## 2. Configure and seed locally

```bash
cp .env.local.example .env.local
# paste your Project URL, anon key, and service_role key into .env.local
npm install
npm run seed   # creates two organisations, test users, and sample photos
npm run dev
```

Open http://localhost:3000.

### Test accounts

`npm run seed` creates two separate organisations so you can see tenant
isolation working - log in as `manager@wildfiregrill.test` and confirm you
see none of Fireaway's sites or photos.

| Role         | Email                         | Scope                                                    |
|--------------|--------------------------------|------------------------------------------------------------|
| OpSpot admin | super@opspot.test             | Every organisation - full admin access                     |
| OpSpot agent | agent@opspot.test             | Every organisation - uploads/replaces/deletes/rates photos |
| Ops manager  | ops@fireaway.test              | Every Fireaway site - view-only, can flag a photo          |
| Site manager | manager@fireaway.test         | Fireaway Camden only - view-only, can flag a photo          |
| Site manager | manager@wildfiregrill.test    | The separate Wildfire Grill organisation - view-only        |

Password for all of them: `Password123!`

`npm run seed` is safe to run only once - it no-ops if the `organisations`
table already has rows. Use the Admin page in the app to add real
organisations/brands/sites/users after that instead of re-running it.

## 3. Deploy to Vercel

1. Push this repo to GitHub (create a new empty repo on GitHub, then `git remote add origin <url>` and `git push -u origin main` from this folder - it's already a local git repo).
2. Go to [vercel.com](https://vercel.com), sign in (GitHub login is easiest), and click **Add New > Project**, then import the GitHub repo.
3. Vercel auto-detects Next.js - no build config changes needed.
4. Before deploying, add seven environment variables from your `.env.local` (**Project Settings > Environment Variables** in Vercel): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (same value as `SUPABASE_URL`), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same value as `SUPABASE_ANON_KEY` - the `NEXT_PUBLIC_` pair is what lets the invite/recovery callback page read the session client-side, see `lib/db/supabase-browser.ts`), `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL` (set this one to your `*.vercel.app` URL, or your custom domain), and `CRON_SECRET` (generate one with `openssl rand -hex 32` - see [Photo retention](#photo-retention) below for what it's for).
5. Deploy. Vercel reads [`vercel.json`](vercel.json) and schedules the retention purge job automatically - no extra setup beyond the env var.
6. Back in the Supabase dashboard, update **Authentication > URL Configuration** with your production URL (Site URL, and add `<your-url>/auth/callback` to Redirect URLs) - otherwise invite emails sent from production will send people to `localhost`.

Anyone with the URL can now open it and log in - no VPN or local server
required. Since captures write to Supabase Storage (not local disk), the
app works the same in production as it does locally.

## How access control works

The hierarchy is `organisation → brand → site → capture`. There are two
groups of roles: OpSpot's own accounts (unrestricted across every
customer) and a customer's own staff (scoped to their own brand/site,
view-only). Every user has a role and a scope, stored on their `profiles`
row:

| Role           | Scope column set | Sees / can do                                                          |
|----------------|-------------------|--------------------------------------------------------------------------|
| `super_admin`  | none (all null)   | OpSpot - every organisation, full admin (brands/sites/menu items/users)  |
| `agent`        | none (all null)   | OpSpot - every organisation, uploads/replaces/deletes/rates photos only  |
| `ops`          | `brand_id`        | Customer - every site under that one brand, view-only, can flag a photo  |
| `site_manager` | `site_id`         | Customer - that one site, view-only, can flag a photo                    |

A customer role can never upload, edit, delete, or set a rating - only
flag a photo with a note (e.g. "tagged as Pepperoni but it's actually
Margherita") for an agent to review. Only `agent`/`super_admin` can reach
the Upload page at all (`requireUploader` in `lib/auth.ts`); only
`super_admin` can reach the Admin page (`requireSuperAdmin`).

This is enforced twice, deliberately:

1. **Postgres row level security** (`supabase/schema.sql`) is the real
   boundary. Almost every read/write in the app runs through
   `lib/db/supabase-server.ts`, a Supabase client bound to the signed-in
   user's own session (not a service-role key) - so even a bug in a page
   component can't leak one organisation's data into another's, because
   the database itself won't return rows outside the caller's scope.
   Row level security scopes *which rows* a role can touch; it can't
   restrict individual *columns*, so a customer's `captures_update`
   access (needed to set the flag columns) is further narrowed in the
   server actions below to only ever touch those columns for that role.
2. **Application-level checks** (`requireUploader`, `requireSuperAdmin`,
   `canManageCaptures` in `lib/auth.ts`, and the authorization checks in
   `lib/actions/admin.ts` and `lib/actions/captures.ts`) gate the things
   that genuinely require the service-role key and therefore bypass RLS
   (inviting a user, writing to Storage), plus the column-level
   restriction above.

Every upload, replace, delete, clear-all, rating change, flag, and
resolve is also written to `capture_events` - an append-only audit log a
`super_admin` can browse from the Admin page's Activity tab, filtered by
site and date.

New users are never given a password directly - a `super_admin` invites
people by email (`lib/actions/admin.ts` → `inviteUserAction`), Supabase
sends an invite email, and the person sets their own password by following
the link (`app/auth/callback` → `app/auth/set-password`).

### Managing access

From Admin > Users, a `super_admin` can also, for an existing user:

- **Edit** their role and scope (e.g. promote a site_manager to ops, or
  move them to a different site) - `updateUserRoleAction`.
- **Deactivate**/**Reactivate** - bans them in Supabase Auth and marks
  `profiles.disabled` (checked again at session time in `lib/auth.ts`, in
  case an already-issued token hasn't expired yet). Reversible, and keeps
  their history (e.g. things they've flagged) intact.
- **Remove** - permanently deletes their profile row and Supabase Auth
  account. Not reversible; use Deactivate instead unless the account
  should be gone for good.

Brand, site, and menu item names can be renamed in place from their
respective Admin tabs (`renameBrandAction`/`renameSiteAction`/
`renameMenuItemAction`).

## Photo storage and privacy

Both storage buckets (`captures`, `menu-items`) are private - there is no
bare URL that serves a photo. Every read generates a short-lived signed
URL server-side (`lib/storagePaths.ts` → `signStoredUrls`, called from
`lib/data/captures.ts` and `lib/data/menuItems.ts`) for rows already
scoped by row level security, so signing never bypasses who's allowed to
see a photo - only how the browser fetches the one they're already
allowed to see. Signed URLs expire after an hour; pages generate a fresh
one on every load.

Uploads are unaffected by this - `lib/actions/captures.ts` still calls
`getPublicUrl()` to build the value stored on a `captures`/`menu_items`
row, even though that URL never resolves directly on a private bucket.
It's kept purely as a stable, parseable path carrier (`objectPathFromStoredUrl`),
which avoided a data migration for existing rows.

## Photo retention

Each organisation has a `retention_days` setting (default 14, editable
per-org from Admin > Organisations). A daily scheduled job
(`app/api/cron/purge-expired-captures`, scheduled in `vercel.json`)
deletes any capture older than its organisation's window - both the
database row and the Storage object - and logs a `purge` event to
`capture_events` for each one.

The job runs with no signed-in user (Vercel Cron doesn't carry a
session), so it uses the service-role client directly rather than the
`lib/data/*` helpers, which all assume an RLS-scoped session. It's
secured by `CRON_SECRET`: Vercel automatically sends
`Authorization: Bearer $CRON_SECRET` on the scheduled request once
that's set as an env var, and the route refuses every request until it's
configured - so there's no way to accidentally leave a public
mass-delete endpoint exposed by forgetting to set it.

## How it's structured

- `app/` - Next.js App Router pages (`/login`, `/dashboard`, `/upload`, `/admin`, `/auth/*`) and their client-side form components.
- `app/api/cron/purge-expired-captures/` - the scheduled retention purge job (see [Photo retention](#photo-retention)).
- `lib/data/` - the data layer. Every ordinary DB read/write goes through these functions (`listSites`, `listCaptures`, etc), each using the user-scoped client so RLS applies. Pages and server actions never touch Supabase directly.
- `lib/db/supabase-server.ts` - the user-scoped, RLS-respecting Supabase client (used for almost everything).
- `lib/db/supabase-admin.ts` - the service-role client, used only for the Auth admin API, Storage writes, signed URL generation, and the cron job (which has no user session to scope a client to).
- `lib/db/supabase-middleware.ts` + `middleware.ts` - refreshes the Supabase Auth session cookie on every request.
- `lib/storagePaths.ts` - turns a stored path-carrier URL back into a Storage object path, and batch-signs paths into short-lived URLs.
- `lib/auth.ts` - `getCurrentUser`/`requireUser`/`requireUploader`/`requireSuperAdmin`/`canManageCaptures`, and `sitesInScope` (which just asks the database what the current user can see).
- `lib/actions/` - server actions backing the forms (login, logout, set-password, upload, admin invite/create-organisation/create-brand/create-site/rename/deactivate/remove).
- `supabase/schema.sql` - the Postgres schema, RLS policies, and storage bucket setup, run once per project.
- `supabase/migrations/` - incremental SQL to run against an existing project when the schema changes; `schema.sql` always reflects the current combined state for a fresh install.
- `scripts/seed.mjs` - one-time seed script for a fresh Supabase project.
- `vercel.json` - schedules the retention purge cron job.

## Uploaded photos

Manually uploaded photos go to the `captures` bucket in Supabase Storage, at
`<site>/<date>/<day-part>/<1|2|3>.<ext>` - see [Photo storage and
privacy](#photo-storage-and-privacy) for how that becomes a URL a browser
can actually load. Uploading a full set of three photos for the same
site/date/day-part deletes whatever was there before and replaces it,
matching the old manual process where a re-shot photo set replaced the PDF
for that day part. Photos are also deleted automatically once they pass
their organisation's retention window - see [Photo
retention](#photo-retention).
