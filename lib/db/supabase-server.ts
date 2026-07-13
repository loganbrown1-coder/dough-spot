import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client scoped to the current request's Supabase Auth session
 * (via cookies), used for every ordinary read/write in the app. Because it
 * carries the signed-in user's JWT rather than the service-role key, every
 * query through this client is subject to the row level security policies
 * in supabase/schema.sql - tenant isolation is enforced by Postgres, not
 * just by application code.
 *
 * Safe to call from Server Components (cookie writes are silently
 * dropped there - see setAll below) as well as Server Actions and Route
 * Handlers (where cookie writes persist normally). Session refresh across
 * Server Component requests is handled by middleware.ts.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY. Copy .env.local.example to .env.local and fill in your Supabase project's values (Project Settings > API)."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, which can't set cookies.
          // Harmless as long as middleware.ts is refreshing sessions.
        }
      },
    },
  });
}
