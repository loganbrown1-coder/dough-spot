import { createClient } from "@/lib/db/supabase-server";
import { objectPathFromStoredUrl, signStoredUrls } from "@/lib/storagePaths";
import type { Brand } from "@/types";

const BUCKET = "brand-logos";

function rowToBrand(row: {
  id: string;
  organisation_id: string;
  name: string;
  logo_url: string | null;
}): Brand {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    logoUrl: row.logo_url,
  };
}

/** Swaps each brand's stored (unresolvable, private-bucket) logo URL for a fresh signed one. */
async function withSignedLogoUrls(brands: Brand[]): Promise<Brand[]> {
  const signed = await signStoredUrls(BUCKET, brands.map((b) => b.logoUrl));
  return brands.map((b) => {
    if (!b.logoUrl) return b;
    const path = objectPathFromStoredUrl(BUCKET, b.logoUrl);
    return path && signed.has(path) ? { ...b, logoUrl: signed.get(path)! } : b;
  });
}

export async function listBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("name");
  if (error) throw error;
  return withSignedLogoUrls((data ?? []).map(rowToBrand));
}

export async function listBrandsByOrganisation(
  organisationId: string
): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("name");
  if (error) throw error;
  return withSignedLogoUrls((data ?? []).map(rowToBrand));
}

export async function getBrand(id: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [brand] = await withSignedLogoUrls([rowToBrand(data)]);
  return brand;
}

/**
 * Deliberately doesn't select the inserted row back - see the comment on
 * createSite in lib/data/sites.ts for why.
 */
export async function createBrand(
  organisationId: string,
  name: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .insert({ organisation_id: organisationId, name });
  if (error) throw error;
}

export async function updateBrandName(id: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").update({ name }).eq("id", id);
  if (error) throw error;
}

/** Sets or (passing null) clears a brand's logo. */
export async function updateBrandLogo(id: string, logoUrl: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").update({ logo_url: logoUrl }).eq("id", id);
  if (error) throw error;
}

/**
 * sites.brand_id and menu_items.brand_id are both "on delete cascade" at
 * the database level, and so is profiles.brand_id - unlike sites (which
 * are protected from cascading into real photo data by captures' "on
 * delete restrict"), a directly-assigned ops user's profile would
 * silently cascade-delete right along with the brand with no FK error to
 * catch. deleteBrandAction pre-checks for sites, menu items in use, and
 * assigned users before ever calling this, so by the time this runs
 * there's nothing left that a raw delete could take down unexpectedly.
 */
export async function deleteBrand(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) throw error;
}
