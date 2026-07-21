import { createClient } from "@/lib/db/supabase-server";
import type { Organisation } from "@/types";

function rowToOrganisation(row: {
  id: string;
  name: string;
  retention_days: number;
}): Organisation {
  return { id: row.id, name: row.name, retentionDays: row.retention_days };
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

/**
 * Deliberately split into an insert, then a separate select-by-name - see
 * the comment on createSite in lib/data/sites.ts for why a combined
 * insert+select can fail. Unlike sites/brands/menu items/day parts, the
 * caller here does need the new row back (its id, to seed default day
 * parts against it), and organisations.name is unique, so a follow-up
 * lookup by name is safe and unambiguous.
 */
export async function createOrganisation(name: string): Promise<Organisation> {
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("organisations").insert({ name });
  if (insertError) throw insertError;

  const { data, error: selectError } = await supabase
    .from("organisations")
    .select("*")
    .eq("name", name)
    .single();
  if (selectError) throw selectError;
  return rowToOrganisation(data);
}

export async function updateOrganisationRetention(
  id: string,
  retentionDays: number
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("organisations")
    .update({ retention_days: retentionDays })
    .eq("id", id);
  if (error) throw error;
}
