# Cut Cam Dashboard

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
2. Once it's provisioned, open **SQL Editor > New query**, paste in the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates every table, the row level security policies, and a public `captures` storage bucket for photos.
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
isolation working - log in as `admin@wildfiregrill.test` and confirm you see
none of Fireaway's sites or photos.

| Role         | Email                       | Scope                                    |
|--------------|------------------------------|-------------------------------------------|
| Super admin  | super@opspot.test           | Every organisation                        |
| Org admin    | admin@fireaway.test         | Everything under the Fireaway organisation|
| Ops          | ops@fireaway.test           | Every site under the Fireaway brand       |
| Site manager | manager@fireaway.test       | Fireaway Camden only                      |
| Org admin    | admin@wildfiregrill.test    | The separate Wildfire Grill organisation  |

Password for all of them: `Password123!`

`npm run seed` is safe to run only once - it no-ops if the `organisations`
table already has rows. Use the Admin page in the app to add real
organisations/brands/sites/users after that instead of re-running it.

## 3. Deploy to Vercel

1. Push this repo to GitHub (create a new empty repo on GitHub, then `git remote add origin <url>` and `git push -u origin main` from this folder - it's already a local git repo).
2. Go to [vercel.com](https://vercel.com), sign in (GitHub login is easiest), and click **Add New > Project**, then import the GitHub repo.
3. Vercel auto-detects Next.js - no build config changes needed.
4. Before deploying, add four environment variables from your `.env.local` (**Project Settings > Environment Variables** in Vercel): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SITE_URL` (set this one to your `*.vercel.app` URL, or your custom domain).
5. Deploy.
6. Back in the Supabase dashboard, update **Authentication > URL Configuration** with your production URL (Site URL, and add `<your-url>/auth/callback` to Redirect URLs) - otherwise invite emails sent from production will send people to `localhost`.

Anyone with the URL can now open it and log in - no VPN or local server
required. Since captures write to Supabase Storage (not local disk), the
app works the same in production as it does locally.

## How access control works

The hierarchy is `organisation → brand → site → capture`. Every user has a
role and a scope, stored on their `profiles` row:

| Role           | Scope column set | Sees                                    |
|----------------|-------------------|------------------------------------------|
| `super_admin`  | none (all null)   | Every organisation                        |
| `org_admin`    | `organisation_id` | Every brand/site in that one organisation |
| `ops`          | `brand_id`        | Every site under that one brand           |
| `site_manager` | `site_id`         | That one site                             |

This is enforced twice, deliberately:

1. **Postgres row level security** (`supabase/schema.sql`) is the real
   boundary. Almost every read/write in the app runs through
   `lib/db/supabase-server.ts`, a Supabase client bound to the signed-in
   user's own session (not a service-role key) - so even a bug in a page
   component can't leak one organisation's data into another's, because
   the database itself won't return rows outside the caller's scope.
2. **Application-level checks** (`requireOrgAdmin`, `requireSuperAdmin` in
   `lib/auth.ts`, and the authorization checks in `lib/actions/admin.ts`)
   gate the two things that genuinely require the service-role key and
   therefore bypass RLS: inviting a new user via the Supabase Auth admin
   API, and writing uploaded photos to Storage. These are the only places
   correctness depends on application code rather than the database.

New users are never given a password directly - `admin`/`org_admin` invite
people by email (`lib/actions/admin.ts` → `inviteUserAction`), Supabase
sends an invite email, and the person sets their own password by following
the link (`app/auth/callback` → `app/auth/set-password`).

## How it's structured

- `app/` - Next.js App Router pages (`/login`, `/dashboard`, `/upload`, `/admin`, `/auth/*`) and their client-side form components.
- `lib/data/` - the data layer. Every ordinary DB read/write goes through these functions (`listSites`, `listCaptures`, etc), each using the user-scoped client so RLS applies. Pages and server actions never touch Supabase directly.
- `lib/db/supabase-server.ts` - the user-scoped, RLS-respecting Supabase client (used for almost everything).
- `lib/db/supabase-admin.ts` - the service-role client, used only for the Auth admin API and Storage writes.
- `lib/db/supabase-middleware.ts` + `middleware.ts` - refreshes the Supabase Auth session cookie on every request.
- `lib/auth.ts` - `getCurrentUser`/`requireUser`/`requireOrgAdmin`/`requireSuperAdmin`, and `sitesInScope` (which just asks the database what the current user can see).
- `lib/actions/` - server actions backing the forms (login, logout, set-password, upload, admin invite/create-organisation/create-brand/create-site).
- `supabase/schema.sql` - the Postgres schema, RLS policies, and storage bucket setup, run once per project.
- `scripts/seed.mjs` - one-time seed script for a fresh Supabase project.

## Uploaded photos

Manually uploaded photos go to the `captures` bucket in Supabase Storage, at
`<site>/<date>/<day-part>/<1|2|3>.<ext>`, and the public URL is stored on the
`captures` row. Uploading a full set of three photos for the same
site/date/day-part deletes whatever was there before and replaces it,
matching the old manual process where a re-shot photo set replaced the PDF
for that day part.
