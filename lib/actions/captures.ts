"use server";

import { getCurrentUser, canAccessSite, canManageCaptures } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import {
  listCaptures,
  replaceCaptures,
  updateCaptureRating,
  updateCaptureMenuItem,
  updateCaptureImage,
  deleteCapture,
  deleteCapturesForDayPart,
  flagCapture,
  resolveFlag,
  type NewCaptureImage,
} from "@/lib/data/captures";
import { logCaptureEvent, listCaptureEvents } from "@/lib/data/captureEvents";
import { objectPathFromStoredUrl } from "@/lib/storagePaths";
import type { Capture, CaptureEvent } from "@/types";

export interface UploadState {
  error?: string;
  success?: boolean;
}

const BUCKET = "captures";
const DAY_PART_IDS = new Set(["A", "B", "C"]);
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extensionFor(file: File): string {
  if (MIME_EXTENSIONS[file.type]) return MIME_EXTENSIONS[file.type];
  const parts = file.name.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  return ext || "jpg";
}

/**
 * Uploads reuse the same object path (site/date/day part/sequence) every
 * time a photo is replaced, so the public URL never changes on its own -
 * browsers and Supabase's CDN (`cache-control: public, max-age=3600`) will
 * keep serving the old image against that URL otherwise. Appending a
 * version query param forces a fresh fetch.
 */
function withCacheBust(url: string): string {
  return `${url}?v=${Date.now()}`;
}

/**
 * Audit logging is best-effort - a logging failure should never block the
 * upload/edit/delete it's describing.
 */
async function logEvent(params: Parameters<typeof logCaptureEvent>[0]): Promise<void> {
  try {
    await logCaptureEvent(params);
  } catch (err) {
    console.error("Failed to log capture event:", err);
  }
}

export async function uploadCapturesAction(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to upload photos." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can upload photos." };
  }

  const siteId = String(formData.get("siteId") ?? "");
  const date = String(formData.get("date") ?? "");
  const dayPartId = String(formData.get("dayPart") ?? "");

  if (!siteId || !date || !dayPartId) {
    return { error: "Site, date, and day part are all required." };
  }
  if (!DAY_PART_IDS.has(dayPartId)) {
    return { error: "Invalid day part." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Invalid date." };
  }
  if (!(await canAccessSite(siteId))) {
    return { error: "You do not have access to that site." };
  }

  const files: File[] = [];
  const menuItemIds: (string | null)[] = [];
  for (const key of ["photo1", "photo2", "photo3"]) {
    const file = formData.get(key);
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Please select all three photos." };
    }
    if (!file.type.startsWith("image/")) {
      return { error: "All three files must be images." };
    }
    files.push(file);
    const menuItemId = String(formData.get(`menuItem${files.length}`) ?? "");
    menuItemIds.push(menuItemId || null);
  }

  const supabase = getSupabaseAdmin();
  const folder = `${siteId}/${date}/${dayPartId}`;

  // Clear out any previous upload for this site/date/day part before
  // writing the new one, since a re-upload fully replaces the old set of
  // photos (and may use different file extensions than last time).
  const { data: existing } = await supabase.storage.from(BUCKET).list(folder);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .remove(existing.map((f) => `${folder}/${f.name}`));
  }

  const images: NewCaptureImage[] = [];
  for (let i = 0; i < files.length; i++) {
    const sequence = i + 1;
    const file = files[i];
    const ext = extensionFor(file);
    const objectPath = `${folder}/${sequence}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType: file.type, upsert: true });
    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    const { data: publicUrl } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(objectPath);

    images.push({
      sequence,
      imageUrl: withCacheBust(publicUrl.publicUrl),
      source: "manual",
      menuItemId: menuItemIds[i],
    });
  }

  const saved = await replaceCaptures({ siteId, date, dayPartId, images });

  for (const capture of saved) {
    await logEvent({
      siteId,
      date,
      dayPartId,
      sequence: capture.sequence,
      captureId: capture.id,
      actorId: user.id,
      actorEmail: user.email,
      action: "upload",
    });
  }

  return { success: true };
}

/**
 * Sets (or, passing null, clears) the star rating on a single photo.
 * Only an agent or admin sets a rating - a customer sees it but can't
 * change it (they can flag it instead, see flagCaptureAction).
 */
export async function rateCaptureAction(
  captureId: string,
  rating: number | null
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to rate photos." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can rate photos." };
  }
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5." };
  }

  try {
    await updateCaptureRating(captureId, rating);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save rating." };
  }
}

/** Retags an already-uploaded photo with a different menu item (or clears it). */
export async function updateCaptureMenuItemAction(
  captureId: string,
  menuItemId: string | null
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can retag a photo." };
  }

  try {
    await updateCaptureMenuItem(captureId, menuItemId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update menu item." };
  }
}

/**
 * The already-uploaded photos for one site/date/day part, for the "current
 * photos for this shift" section on the upload page. RLS (`captures_select`)
 * is what actually enforces the caller can see this site.
 */
export async function getExistingCapturesAction(
  siteId: string,
  date: string,
  dayPartId: string
): Promise<{ captures: Capture[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { captures: [], error: "You must be signed in." };

  try {
    const all = await listCaptures({ siteId, date });
    return { captures: all.filter((c) => c.dayPartId === dayPartId) };
  } catch (err) {
    return {
      captures: [],
      error: err instanceof Error ? err.message : "Failed to load existing photos.",
    };
  }
}

/**
 * Replaces the image behind an existing capture in place, keeping its
 * sequence slot and menu item tag. Mirrors uploadCapturesAction's
 * storage-write pattern for a single photo instead of all three.
 */
export async function replaceCaptureImageAction(
  captureId: string,
  siteId: string,
  date: string,
  dayPartId: string,
  sequence: number,
  file: File
): Promise<{ error?: string; imageUrl?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can replace a photo." };
  }
  if (!(await canAccessSite(siteId))) {
    return { error: "You do not have access to that site." };
  }
  if (!file.type.startsWith("image/")) return { error: "File must be an image." };

  const admin = getSupabaseAdmin();
  const folder = `${siteId}/${date}/${dayPartId}`;

  // The replacement may use a different extension than what's already
  // there, so clear anything at this sequence before writing the new file.
  const { data: existing } = await admin.storage.from(BUCKET).list(folder);
  const stale = (existing ?? []).filter((f) => f.name.startsWith(`${sequence}.`));
  if (stale.length > 0) {
    await admin.storage.from(BUCKET).remove(stale.map((f) => `${folder}/${f.name}`));
  }

  const ext = extensionFor(file);
  const objectPath = `${folder}/${sequence}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  const imageUrl = withCacheBust(publicUrl.publicUrl);

  try {
    await updateCaptureImage(captureId, imageUrl);
    await logEvent({
      siteId,
      date,
      dayPartId,
      sequence,
      captureId,
      actorId: user.id,
      actorEmail: user.email,
      action: "replace",
    });
    return { imageUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save photo." };
  }
}

/** Deletes a single photo, including its storage object. */
export async function deleteCaptureAction(
  captureId: string,
  siteId: string,
  date: string,
  dayPartId: string,
  sequence: number
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can delete a photo." };
  }

  // Fetched here (not passed in from the client) because the client only
  // ever has a short-lived signed URL, not the stored path-carrier value
  // needed to find the storage object.
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("captures")
    .select("image_url")
    .eq("id", captureId)
    .maybeSingle();

  try {
    await deleteCapture(captureId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete photo." };
  }

  const path = row?.image_url ? objectPathFromStoredUrl(BUCKET, row.image_url) : null;
  if (path) {
    await admin.storage.from(BUCKET).remove([path]);
  }

  await logEvent({
    siteId,
    date,
    dayPartId,
    sequence,
    captureId,
    actorId: user.id,
    actorEmail: user.email,
    action: "delete",
  });

  return {};
}

/** Clears every photo in a day part at once - e.g. an upload to the wrong shift. */
export async function deleteDayPartCapturesAction(
  siteId: string,
  date: string,
  dayPartId: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can clear a day part." };
  }
  if (!(await canAccessSite(siteId))) {
    return { error: "You do not have access to that site." };
  }

  const existingCaptures = (await listCaptures({ siteId, date })).filter(
    (c) => c.dayPartId === dayPartId
  );

  try {
    await deleteCapturesForDayPart({ siteId, date, dayPartId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to clear day part." };
  }

  const admin = getSupabaseAdmin();
  const folder = `${siteId}/${date}/${dayPartId}`;
  const { data: existing } = await admin.storage.from(BUCKET).list(folder);
  if (existing && existing.length > 0) {
    await admin.storage.from(BUCKET).remove(existing.map((f) => `${folder}/${f.name}`));
  }

  for (const capture of existingCaptures) {
    await logEvent({
      siteId,
      date,
      dayPartId,
      sequence: capture.sequence,
      captureId: capture.id,
      actorId: user.id,
      actorEmail: user.email,
      action: "clear_day_part",
    });
  }

  return {};
}

/**
 * A customer (ops/site_manager) flags a photo with a note - e.g. it was
 * tagged as the wrong menu item - for an agent to review. Open to anyone
 * who can see the capture, not just customer roles.
 */
export async function flagCaptureAction(
  captureId: string,
  siteId: string,
  date: string,
  dayPartId: string,
  sequence: number,
  comment: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!comment.trim()) return { error: "Add a note about what's wrong." };

  try {
    await flagCapture(captureId, comment.trim(), user.id, user.email);
    await logEvent({
      siteId,
      date,
      dayPartId,
      sequence,
      captureId,
      actorId: user.id,
      actorEmail: user.email,
      action: "flag",
      detail: comment.trim(),
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to flag photo." };
  }
}

/** The activity log for one site/date - the admin "Activity" tab. */
export async function getCaptureEventsAction(
  siteId: string,
  date: string
): Promise<{ events: CaptureEvent[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { events: [], error: "You must be signed in." };
  if (user.role !== "super_admin") {
    return { events: [], error: "Only OpSpot admins can view the activity log." };
  }

  try {
    return { events: await listCaptureEvents({ siteId, date }) };
  } catch (err) {
    return {
      events: [],
      error: err instanceof Error ? err.message : "Failed to load activity.",
    };
  }
}

/** An agent/admin clears a flag once they've reviewed and fixed it. */
export async function resolveFlagAction(
  captureId: string,
  siteId: string,
  date: string,
  dayPartId: string,
  sequence: number
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can resolve a flag." };
  }

  try {
    await resolveFlag(captureId);
    await logEvent({
      siteId,
      date,
      dayPartId,
      sequence,
      captureId,
      actorId: user.id,
      actorEmail: user.email,
      action: "resolve_flag",
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to resolve flag." };
  }
}
