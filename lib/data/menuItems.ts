import { createClient } from "@/lib/db/supabase-server";
import { objectPathFromStoredUrl, signStoredUrls } from "@/lib/storagePaths";
import type { MenuItem } from "@/types";

const BUCKET = "menu-items";

function rowToMenuItem(row: {
  id: string;
  brand_id: string;
  name: string;
  reference_image_url: string | null;
  created_at: string;
}): MenuItem {
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    referenceImageUrl: row.reference_image_url,
    createdAt: row.created_at,
  };
}

/** Swaps each item's stored (unresolvable, private-bucket) URL for a fresh signed one. */
async function withSignedUrls(items: MenuItem[]): Promise<MenuItem[]> {
  const signed = await signStoredUrls(BUCKET, items.map((i) => i.referenceImageUrl));
  return items.map((i) => {
    if (!i.referenceImageUrl) return i;
    const path = objectPathFromStoredUrl(BUCKET, i.referenceImageUrl);
    return path && signed.has(path)
      ? { ...i, referenceImageUrl: signed.get(path)! }
      : i;
  });
}

export async function listMenuItems(): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("name");
  if (error) throw error;
  return withSignedUrls((data ?? []).map(rowToMenuItem));
}

export async function listMenuItemsByBrand(brandId: string): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("brand_id", brandId)
    .order("name");
  if (error) throw error;
  return withSignedUrls((data ?? []).map(rowToMenuItem));
}

export async function updateMenuItemName(id: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").update({ name }).eq("id", id);
  if (error) throw error;
}

/**
 * Deliberately doesn't select the inserted row back - see the comment on
 * createSite in lib/data/sites.ts for why.
 */
export async function createMenuItem(params: {
  brandId: string;
  name: string;
  referenceImageUrl?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").insert({
    brand_id: params.brandId,
    name: params.name,
    reference_image_url: params.referenceImageUrl ?? null,
  });
  if (error) throw error;
}
