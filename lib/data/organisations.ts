import { createClient } from "@/lib/db/supabase-server";
import type { Organisation } from "@/types";

function rowToOrganisation(row: { id: string; name: string }): Organisation {
  return { id: row.id, name: row.name };
}

export async function listOrganisations(): Promise<Organisation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(rowToOrganisation);
}

export async function getOrganisation(id: string): Promise<Organisation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToOrganisation(data) : null;
}

export async function createOrganisation(name: string): Promise<Organisation> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisations")
    .insert({ name })
    .select("*")
    .single();
  if (error) throw error;
  return rowToOrganisation(data);
}
