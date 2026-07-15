import { createClient } from "@/lib/db/supabase-server";
import type { Profile } from "@/types";

function rowToProfile(row: {
  id: string;
  email: string;
  role: string;
  organisation_id: string | null;
  brand_id: string | null;
  site_id: string | null;
  created_at: string;
}): Profile {
  return {
    id: row.id,
    email: row.email,
    role: row.role as Profile["role"],
    organisationId: row.organisation_id,
    brandId: row.brand_id,
    siteId: row.site_id,
    createdAt: row.created_at,
  };
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : null;
}

/**
 * Every profile the current user can see, per the `profiles_select` row
 * level security policy: their own row, plus (for super_admin) everyone.
 * Not filtered further in JS.
 */
export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("email");
  if (error) throw error;
  return (data ?? []).map(rowToProfile);
}
