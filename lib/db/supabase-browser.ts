"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client, used only by the invite/recovery callback
 * page (app/auth/callback) to read the access/refresh tokens Supabase
 * puts in the URL fragment - fragments never reach the server, so that
 * one case can't go through lib/db/supabase-server.ts like everything
 * else in the app does. @supabase/ssr's browser client writes the
 * resulting session to cookies (not localStorage), so the server-side
 * client picks up the same session on the very next request.
 */
export function createClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
