import { createClient } from "@/lib/db/supabase-server";
import type { DayPart } from "@/types";

function rowToDayPart(row: {
  id: string;
  organisation_id: string;
  label: string;
  start_time: string;
  end_time: string;
}): DayPart {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    label: row.label,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

/**
 * Every day part the caller can see, across every organisation in scope -
 * row level security (day_parts_select) does the actual scoping. Used by
 * pages like /flags that span multiple organisations at once.
 */
export async function listDayParts(): Promise<DayPart[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_parts")
    .select("*")
    .order("start_time");
  if (error) throw error;
  return (data ?? []).map(rowToDayPart);
}

export async function listDayPartsByOrganisation(organisationId: string): Promise<DayPart[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_parts")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("start_time");
  if (error) throw error;
  return (data ?? []).map(rowToDayPart);
}

export async function getDayPart(id: string): Promise<DayPart | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_parts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDayPart(data) : null;
}

/**
 * Deliberately doesn't select the inserted row back - see the comment on
 * createSite in lib/data/sites.ts for why.
 */
export async function createDayPart(params: {
  organisationId: string;
  label: string;
  startTime: string;
  endTime: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("day_parts").insert({
    organisation_id: params.organisationId,
    label: params.label,
    start_time: params.startTime,
    end_time: params.endTime,
  });
  if (error) throw error;
}

export async function updateDayPart(
  id: string,
  params: { label: string; startTime: string; endTime: string }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("day_parts")
    .update({ label: params.label, start_time: params.startTime, end_time: params.endTime })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Fails with a foreign key violation if any capture still references this
 * day part - captures.day_part_id is "on delete restrict" precisely so a
 * day part with photo history can't be silently removed. The caller
 * (deleteDayPartAction) checks for this ahead of time to give a clearer
 * error than the raw constraint violation.
 */
export async function deleteDayPart(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("day_parts").delete().eq("id", id);
  if (error) throw error;
}
