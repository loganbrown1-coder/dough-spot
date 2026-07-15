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

export async function createSite(brandId: string, name: string): Promise<Site> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .insert({ brand_id: brandId, name })
    .select("*")
    .single();
  if (error) throw error;
  return rowToSite(data);
}

export async function updateSiteName(id: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").update({ name }).eq("id", id);
  if (error) throw error;
}
