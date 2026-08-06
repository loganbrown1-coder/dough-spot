import { createClient } from "@/lib/db/supabase-server";
import {
  objectPathFromStoredUrl,
  signStoredUrls,
  signObjectPaths,
  thumbnailPathFor,
} from "@/lib/storagePaths";
import type { Capture, CaptureSource } from "@/types";

const BUCKET = "captures";

/**
 * Swaps each capture's stored (unresolvable, private-bucket) URL for a
 * fresh signed one, and resolves its small thumbnail sibling the same way
 * - null when no thumbnail exists yet (a capture uploaded before
 * thumbnails existed), which is exactly the "not signed" case
 * signObjectPaths already leaves out of its returned map. Never touches
 * the underlying files, only which URLs get handed back for this request.
 */
async function withSignedUrls(captures: Capture[]): Promise<Capture[]> {
  const fullPaths = captures.map((c) => objectPathFromStoredUrl(BUCKET, c.imageUrl));
  const thumbPaths = fullPaths.map((p) => (p ? thumbnailPathFor(p) : null));

  const [signedFull, signedThumb] = await Promise.all([
    signStoredUrls(BUCKET, captures.map((c) => c.imageUrl)),
    signObjectPaths(
      BUCKET,
      thumbPaths.filter((p): p is string => Boolean(p))
    ),
  ]);

  return captures.map((c, i) => {
    const path = fullPaths[i];
    const imageUrl = path && signedFull.has(path) ? signedFull.get(path)! : c.imageUrl;
    const thumbPath = thumbPaths[i];
    const thumbnailUrl = thumbPath && signedThumb.has(thumbPath) ? signedThumb.get(thumbPath)! : null;
    return { ...c, imageUrl, thumbnailUrl };
  });
}

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
  comment: string | null;
  flagged: boolean;
  flag_comment: string | null;
  flagged_by: string | null;
  flagged_by_email: string | null;
  flagged_at: string | null;
}): Capture {
  return {
    id: row.id,
    siteId: row.site_id,
    date: row.date,
    dayPartId: row.day_part_id,
    sequence: row.sequence,
    imageUrl: row.image_url,
    // Resolved by withSignedUrls for display reads - left null here since
    // getCapture() (delete-verification only, never rendered) skips that
    // step entirely.
    thumbnailUrl: null,
    capturedAt: row.captured_at,
    source: row.source as CaptureSource,
    menuItemId: row.menu_item_id,
    comment: row.comment,
    flagged: row.flagged,
    flagComment: row.flag_comment,
    flaggedBy: row.flagged_by,
    flaggedByEmail: row.flagged_by_email,
    flaggedAt: row.flagged_at,
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
  return withSignedUrls((data ?? []).map(rowToCapture));
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
  return withSignedUrls((data ?? []).map(rowToCapture));
}

/**
 * The most recent date with any photos across every site the caller can
 * see - used to default the dashboard to whichever day most recently had
 * uploads (typically yesterday) instead of an empty "today" view. Purely
 * a read; returns null (caller falls back to today) for a brand-new
 * organisation with no captures yet.
 */
export async function getMostRecentCaptureDate(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.date ?? null;
}

/**
 * Captures across every date rather than one - the dashboard's "All
 * dates" view, optionally scoped to a single site. Capped to the most
 * recent rows rather than fetched unbounded: retention already purges
 * old data, and this view is for browsing recent history, not a full
 * export - picking an exact date still gets you precise results via
 * listCaptures/listCapturesByDate.
 */
const ALL_DATES_ROW_LIMIT = 1500;

export async function listCapturesAllDates(params: { siteId?: string }): Promise<Capture[]> {
  const supabase = await createClient();
  let query = supabase
    .from("captures")
    .select("*")
    .order("date", { ascending: false })
    .order("site_id")
    .order("day_part_id")
    .order("sequence")
    .limit(ALL_DATES_ROW_LIMIT);
  if (params.siteId) query = query.eq("site_id", params.siteId);
  const { data, error } = await query;
  if (error) throw error;
  return withSignedUrls((data ?? []).map(rowToCapture));
}

/**
 * Every currently-flagged capture the caller can see, across every site
 * and date - the /flags inbox. Not scoped to "today" like the dashboard,
 * since a flag raised days ago is still unresolved until someone acts on
 * it. RLS scopes this the same as everything else; in practice only
 * agent/super_admin reach the page this backs.
 */
export async function listFlaggedCaptures(): Promise<Capture[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("flagged", true)
    .order("flagged_at", { ascending: false });
  if (error) throw error;
  return withSignedUrls((data ?? []).map(rowToCapture));
}

export interface NewCaptureImage {
  sequence: number;
  imageUrl: string;
  source: CaptureSource;
  menuItemId?: string | null;
  comment?: string | null;
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
    comment: image.comment ?? null,
  }));

  const { data, error: insertError } = await supabase
    .from("captures")
    .insert(rows)
    .select("*");
  if (insertError) throw insertError;

  return (data ?? []).map(rowToCapture);
}

/**
 * Adds a single new capture to one currently-empty sequence slot, without
 * touching whatever else exists in that day part - unlike replaceCaptures,
 * which always provides (and replaces) the full set of three. This is what
 * lets someone add just the photo they actually have when a shift is only
 * partially uploaded, instead of being forced to resubmit all three.
 * unique(site_id, date, day_part_id, sequence) is what actually guarantees
 * this can't silently overwrite an existing photo - a concurrent add to
 * the same slot fails here with a constraint violation instead.
 */
export async function addCapture(params: {
  siteId: string;
  date: string;
  dayPartId: string;
  image: NewCaptureImage;
}): Promise<Capture> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .insert({
      site_id: params.siteId,
      date: params.date,
      day_part_id: params.dayPartId,
      sequence: params.image.sequence,
      image_url: params.image.imageUrl,
      captured_at: new Date().toISOString(),
      source: params.image.source,
      menu_item_id: params.image.menuItemId ?? null,
      comment: params.image.comment ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToCapture(data);
}

/** Retags a single capture with a different menu item, or clears it. */
export async function updateCaptureMenuItem(
  captureId: string,
  menuItemId: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("captures")
    .update({ menu_item_id: menuItemId })
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
/**
 * RLS-scoped fetch by id - returns null if the capture doesn't exist OR
 * the caller can't access its site, which callers rely on to gate
 * privileged follow-up work (e.g. deleting the underlying storage object)
 * on real access rather than trusting a client-supplied siteId.
 */
export async function getCapture(captureId: string): Promise<Capture | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("id", captureId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCapture(data) : null;
}

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

/**
 * Flags a photo with a note for an agent to review - e.g. it was tagged
 * as the wrong menu item. Anyone who can see the capture can flag it
 * (`captures_update` row level security), not just customer roles.
 */
export async function flagCapture(
  captureId: string,
  comment: string,
  flaggedBy: string,
  flaggedByEmail: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("captures")
    .update({
      flagged: true,
      flag_comment: comment,
      flagged_by: flaggedBy,
      flagged_by_email: flaggedByEmail,
      flagged_at: new Date().toISOString(),
    })
    .eq("id", captureId);
  if (error) throw error;
}

/** Clears a flag once it's been reviewed. */
export async function resolveFlag(captureId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("captures")
    .update({
      flagged: false,
      flag_comment: null,
      flagged_by: null,
      flagged_by_email: null,
      flagged_at: null,
    })
    .eq("id", captureId);
  if (error) throw error;
}

/** Used by deleteDayPartAction to give a clear error instead of a raw foreign key violation. */
export async function countCapturesForDayPart(dayPartId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("captures")
    .select("*", { count: "exact", head: true })
    .eq("day_part_id", dayPartId);
  if (error) throw error;
  return count ?? 0;
}

/** Used by deleteSiteAction to give a clear error instead of a raw foreign key violation. */
export async function countCapturesForSite(siteId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("captures")
    .select("*", { count: "exact", head: true })
    .eq("site_id", siteId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Used by deleteBrandAction. By the time it's called, the brand already
 * has zero sites left (checked first), so structurally no capture could
 * reference one of its menu items through the normal upload flow - this
 * is a defensive check, not the primary guard, in case that's ever not
 * true (e.g. a menu item shared or moved in some way this app doesn't
 * currently do). menuItemIds empty means nothing to check.
 */
export async function countCapturesUsingMenuItems(menuItemIds: string[]): Promise<number> {
  if (menuItemIds.length === 0) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("captures")
    .select("*", { count: "exact", head: true })
    .in("menu_item_id", menuItemIds);
  if (error) throw error;
  return count ?? 0;
}
