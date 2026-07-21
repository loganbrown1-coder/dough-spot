import { createClient } from "@/lib/db/supabase-server";
import type { Site } from "@/types";

function rowToSite(row: { id: string; brand_id: string; name: string }): Site {
  return { id: row.id, brandId: row.brand_id, name: row.name };
}

/**
 * Every site the current user can see, per the `sites_select` row level
 * security policy. Not filtered further in JS - RLS is the source of
 * truth for scoping.
 */
export async function listSites(): Promise<Site[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(rowToSite);
}

export async function listSitesByBrand(brandId: string): Promise<Site[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("brand_id", brandId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(rowToSite);
}

export async function getSite(id: string): Promise<Site | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSite(data) : null;
}

/**
 * Deliberately doesn't select the inserted row back - combining an insert
 * with a same-statement read on a table whose own row level security
 * policy is what gates the insert can make Postgres reject the write
 * entirely (a real, narrow Postgres/RLS interaction, confirmed by testing
 * the same insert as two separate statements instead, which works fine -
 * see the retention/day-parts commit history for the write-up). None of
 * the callers need the created row back, so the simplest fix is to not
 * ask for it.
 */
export async function createSite(brandId: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").insert({ brand_id: brandId, name });
  if (error) throw error;
}

export async function updateSiteName(id: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").update({ name }).eq("id", id);
  if (error) throw error;
}

/**
 * Fails with a foreign key violation if the site still has captures,
 * audit history, or an assigned user - all three are "on delete
 * restrict" precisely so this can't happen silently. The caller
 * (deleteSiteAction) checks for these ahead of time to give a clearer
 * error than the raw constraint violation.
 */
export async function deleteSite(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) throw error;
}
