import { createClient } from "@/lib/db/supabase-server";
import type { Brand } from "@/types";

function rowToBrand(row: {
  id: string;
  organisation_id: string;
  name: string;
}): Brand {
  return { id: row.id, organisationId: row.organisation_id, name: row.name };
}

export async function listBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(rowToBrand);
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
  return (data ?? []).map(rowToBrand);
}

export async function getBrand(id: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBrand(data) : null;
}

export async function createBrand(
  organisationId: string,
  name: string
): Promise<Brand> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({ organisation_id: organisationId, name })
    .select("*")
    .single();
  if (error) throw error;
  return rowToBrand(data);
}

export async function updateBrandName(id: string, name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").update({ name }).eq("id", id);
  if (error) throw error;
}
