import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  __doughSpotSupabaseAdmin?: SupabaseClient;
};

/**
 * Server-only Supabase client using the service-role key, which bypasses
 * row level security entirely. Only used where that's actually required:
 * the Supabase Auth admin API (inviting/creating users, which can't be
 * called with a user's own session), and writes to Storage. Every other
 * read/write in the app goes through lib/db/supabase-server.ts instead, so
 * RLS applies.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (globalForSupabase.__doughSpotSupabaseAdmin) {
    return globalForSupabase.__doughSpotSupabaseAdmin;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.local.example to .env.local and fill in your Supabase project's values (Project Settings > API)."
    );
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  globalForSupabase.__doughSpotSupabaseAdmin = client;
  return client;
}
