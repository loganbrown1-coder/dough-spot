import { createClient } from "@/lib/db/supabase-server";
import type { Capture, CaptureSource } from "@/types";

function rowToCapture(row: {
  id: string;
  site_id: string;
  date: string;
  day_part_id: string;
  sequence: number;
  image_url: string;
  captured_at: string;
  source: string;
  menu_item_id: string | null;
  rating: number | null;
}): Capture {
  return {
    id: row.id,
    siteId: row.site_id,
    date: row.date,
    dayPartId: row.day_part_id,
    sequence: row.sequence,
    imageUrl: row.image_url,
    capturedAt: row.captured_at,
    source: row.source as CaptureSource,
    menuItemId: row.menu_item_id,
    rating: row.rating,
  };
}

export async function listCaptures(params: {
  siteId: string;
  date: string;
}): Promise<Capture[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("site_id", params.siteId)
    .eq("date", params.date)
    .order("day_part_id")
    .order("sequence");
  if (error) throw error;
  return (data ?? []).map(rowToCapture);
}

/**
 * Every capture for a given date across every site the caller can see -
 * not filtered to one site. Row level security (`captures_select`) is
 * what actually scopes this to sites in the caller's access, so this is
 * safe to call without a siteId; it just returns fewer rows for a
 * site_manager than for an org_admin.
 */
export async function listCapturesByDate(date: string): Promise<Capture[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("date", date)
    .order("site_id")
    .order("day_part_id")
    .order("sequence");
  if (error) throw error;
  return (data ?? []).map(rowToCapture);
}

export interface NewCaptureImage {
  sequence: number;
  imageUrl: string;
  source: CaptureSource;
  menuItemId?: string | null;
}

/**
 * Replaces all captures for a given site/date/day part. This mirrors the
 * behaviour of the old manual process, where a re-upload for a day part
 * fully replaces the previous set of three photos. Runs through the
 * user-scoped client, so the `captures_insert`/`captures_delete` row level
 * security policies re-check that the caller's role/scope actually covers
 * this site - the same rule the sites dropdown was built from, now
 * enforced again at the database layer.
 */
export async function replaceCaptures(params: {
  siteId: string;
  date: string;
  dayPartId: string;
  images: NewCaptureImage[];
}): Promise<Capture[]> {
  const supabase = await createClient();
  const capturedAt = new Date().toISOString();

  const { error: deleteError } = await supabase
    .from("captures")
    .delete()
    .eq("site_id", params.siteId)
    .eq("date", params.date)
    .eq("day_part_id", params.dayPartId);
  if (deleteError) throw deleteError;

  const rows = params.images.map((image) => ({
    site_id: params.siteId,
    date: params.date,
    day_part_id: params.dayPartId,
    sequence: image.sequence,
    image_url: image.imageUrl,
    captured_at: capturedAt,
    source: image.source,
    menu_item_id: image.menuItemId ?? null,
  }));

  const { data, error: insertError } = await supabase
    .from("captures")
    .insert(rows)
    .select("*");
  if (insertError) throw insertError;

  return (data ?? []).map(rowToCapture);
}

/**
 * Sets or clears the star rating (1-5, or null to clear) on a single
 * capture. Anyone who can see the capture can rate it - enforced by the
 * `captures_update` row level security policy, not an app-level check.
 */
export async function updateCaptureRating(
  captureId: string,
  rating: number | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("captures")
    .update({ rating })
    .eq("id", captureId);
  if (error) throw error;
}

/** Points a capture at a newly-uploaded replacement image. */
export async function updateCaptureImage(
  captureId: string,
  imageUrl: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("captures")
    .update({ image_url: imageUrl, captured_at: new Date().toISOString() })
    .eq("id", captureId);
  if (error) throw error;
}

/**
 * Deletes a single capture row. Scoped by the `captures_delete` row level
 * security policy, the same one `replaceCaptures` relies on.
 */
export async function deleteCapture(captureId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("captures").delete().eq("id", captureId);
  if (error) throw error;
}

/** Wipes every capture for a site/date/day part - the "clear all" case. */
export async function deleteCapturesForDayPart(params: {
  siteId: string;
  date: string;
  dayPartId: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("captures")
    .delete()
    .eq("site_id", params.siteId)
    .eq("date", params.date)
    .eq("day_part_id", params.dayPartId);
  if (error) throw error;
}
