import { createClient } from "@/lib/db/supabase-server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { objectPathFromStoredUrl, signStoredUrls } from "@/lib/storagePaths";
import { mimeTypeFromExtension } from "@/lib/imageUpload";
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

export async function getMenuItem(id: string): Promise<MenuItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [item] = await withSignedUrls([rowToMenuItem(data)]);
  return item;
}

export interface MenuItemReference {
  menuItemId: string;
  name: string;
  imageBuffer: Buffer;
  mimeType: string;
}

/**
 * Downloads the actual bytes behind every menu item in a brand that has a
 * reference photo set, for the quality-scoring identification step (see
 * lib/quality/assessCapture.ts's referenceItems param) - not just their
 * signed URLs, since those need fetching over the network on every scoring
 * call otherwise. Uses the service-role client and re-derives each object
 * path directly rather than going through withSignedUrls, since a signed
 * URL is for a browser to fetch, not something this server-side download
 * needs. Items without a reference photo yet are silently skipped - this
 * is the thing that makes identification a no-op (see
 * scoreCaptureInBackground) until Fireaway populate them, rather than
 * something that needs a feature flag.
 */
export async function getMenuItemReferences(brandId: string): Promise<MenuItemReference[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("menu_items")
    .select("id, name, reference_image_url")
    .eq("brand_id", brandId)
    .not("reference_image_url", "is", null);
  if (error) throw error;

  const results: MenuItemReference[] = [];
  for (const row of data ?? []) {
    const path = row.reference_image_url && objectPathFromStoredUrl(BUCKET, row.reference_image_url);
    if (!path) continue;

    const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(path);
    if (downloadError || !file) continue; // best-effort - one missing reference photo shouldn't break scoring for the rest

    const ext = path.split(".").pop() ?? "jpg";
    results.push({
      menuItemId: row.id,
      name: row.name,
      imageBuffer: Buffer.from(await file.arrayBuffer()),
      mimeType: mimeTypeFromExtension(ext),
    });
  }
  return results;
}

/**
 * The raw (unsigned) stored URL, for computing a storage path to delete or
 * replace - never for display. getMenuItem() always returns a signed URL
 * (browser-facing), which objectPathFromStoredUrl can't parse back into a
 * path (it only matches the raw "/object/public/..." shape a signed URL
 * doesn't have), so a caller that needs the actual object path has to go
 * through this instead.
 */
export async function getMenuItemRawImageUrl(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("reference_image_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.reference_image_url ?? null;
}

export async function updateMenuItemName(id: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function updateMenuItemImage(id: string, referenceImageUrl: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ reference_image_url: referenceImageUrl })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Fails with a foreign key violation if any capture still references this
 * menu item - captures.menu_item_id has no "on delete" clause, so it
 * defaults to restrict. The caller (deleteMenuItemAction) checks for this
 * ahead of time via countCapturesUsingMenuItems to give a clearer error
 * than the raw constraint violation.
 */
export async function deleteMenuItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
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
