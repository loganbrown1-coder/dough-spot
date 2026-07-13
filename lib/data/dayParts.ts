import { createClient } from "@/lib/db/supabase-server";
import type { DayPart } from "@/types";

function rowToDayPart(row: {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
}): DayPart {
  return {
    id: row.id,
    label: row.label,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

export async function listDayParts(): Promise<DayPart[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_parts")
    .select("*")
    .order("id");
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
