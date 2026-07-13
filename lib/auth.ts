import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase-server";
import { getProfileById } from "@/lib/data/profiles";
import type { Profile, Site } from "@/types";

export async function getCurrentUser(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    return await getProfileById(user.id);
  } catch (err) {
    // If Supabase is unreachable or misconfigured, fail closed (treat as
    // logged out) rather than 500ing every page in the app.
    console.error("Failed to resolve current user:", err);
    return null;
  }
}

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** org_admin or super_admin - i.e. anyone allowed on the /admin page. */
export async function requireOrgAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (user.role !== "org_admin" && user.role !== "super_admin") {
    redirect("/dashboard");
  }
  return user;
}

/** super_admin only - cross-organisation management. */
export async function requireSuperAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/dashboard");
  return user;
}

/**
 * Every site the current user is allowed to see or upload to. This relies
 * entirely on the `sites_select` row level security policy (see
 * supabase/schema.sql) rather than reimplementing the role/scope logic in
 * JS - the database is the single source of truth for who can see what.
 */
export async function sitesInScope(): Promise<Site[]> {
  const { listSites } = await import("@/lib/data/sites");
  return listSites();
}

export async function canAccessSite(siteId: string): Promise<boolean> {
  const scoped = await sitesInScope();
  return scoped.some((s) => s.id === siteId);
}
