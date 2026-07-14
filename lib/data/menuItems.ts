import { createClient } from "@/lib/db/supabase-server";
import type { MenuItem } from "@/types";

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

export async function listMenuItems(): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(rowToMenuItem);
}

export async function listMenuItemsByBrand(brandId: string): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("brand_id", brandId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(rowToMenuItem);
}

export async function createMenuItem(params: {
  brandId: string;
  name: string;
  referenceImageUrl?: string | null;
}): Promise<MenuItem> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      brand_id: params.brandId,
      name: params.name,
      reference_image_url: params.referenceImageUrl ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToMenuItem(data);
}
