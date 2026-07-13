import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase Auth session cookie on every matched request.
 * Server Components can't write cookies themselves (see
 * lib/db/supabase-server.ts), so without this, a session whose access
 * token expires mid-visit would never get silently refreshed and the user
 * would appear to be logged out unpredictably.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Let the request through unauthenticated rather than crashing every
    // route in the app - getCurrentUser() will surface the missing-env-var
    // error with clearer guidance once a page actually needs the session.
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Do not add logic between createServerClient and getUser() - it forces
  // a round trip to Supabase to validate the token on every request, and
  // that's what keeps the cookie itself fresh.
  await supabase.auth.getUser();

  return supabaseResponse;
}
