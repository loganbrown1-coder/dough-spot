import { createClient } from "@/lib/db/supabase-server";

/**
 * Appends one row per successful sign-in, for the per-user login frequency
 * shown in Admin > Users. Called from lib/actions/auth.ts's loginAction,
 * which wraps this in a try/catch - same best-effort treatment as
 * logCaptureEvent, since a logging failure should never block a real
 * sign-in.
 */
export async function logLoginEvent(userId: string, email: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("login_events").insert({ user_id: userId, email });
  if (error) throw error;
}

export interface LoginStats {
  count: number;
  lastLoginAt: string;
}

/**
 * Login count and most recent sign-in per user, for the Users tab.
 * RLS (`login_events_select`) restricts this to super_admin - anyone else
 * calling it gets an empty result, not an error, since captureEvents-style
 * append-only logs use select policies that just return nothing rather
 * than reject the query outright.
 */
export async function listLoginStatsByUser(): Promise<Map<string, LoginStats>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("login_events")
    .select("user_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const byUser = new Map<string, LoginStats>();
  for (const row of data ?? []) {
    if (!row.user_id) continue;
    const existing = byUser.get(row.user_id);
    if (existing) existing.count += 1;
    // First hit per user_id wins the timestamp - already ordered newest first.
    else byUser.set(row.user_id, { count: 1, lastLoginAt: row.created_at });
  }
  return byUser;
}
