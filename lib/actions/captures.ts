"use server";

import { getCurrentUser, canAccessSite } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import {
  listCaptures,
  replaceCaptures,
  updateCaptureRating,
  updateCaptureImage,
  deleteCapture,
  deleteCapturesForDayPart,
  type NewCaptureImage,
} from "@/lib/data/captures";
import type { Capture } from "@/types";

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

/** Recovers the storage object path from a `captures` bucket public URL. */
function objectPathFromPublicUrl(imageUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = imageUrl.slice(idx + marker.length).split("?")[0];
  return decodeURIComponent(path);
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

export async function uploadCapturesAction(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to upload photos." };

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

  await replaceCaptures({ siteId, date, dayPartId, images });

  return { success: true };
}

/**
 * Sets (or, passing null, clears) the star rating on a single photo.
 * Authorization is enforced entirely by the `captures_update` row level
 * security policy - anyone whose scope covers the photo can rate it,
 * matching who can already see it on the dashboard.
 */
export async function rateCaptureAction(
  captureId: string,
  rating: number | null
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to rate photos." };
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
    return { imageUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save photo." };
  }
}

/** Deletes a single photo, including its storage object. */
export async function deleteCaptureAction(
  captureId: string,
  imageUrl: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  try {
    await deleteCapture(captureId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete photo." };
  }

  const path = objectPathFromPublicUrl(imageUrl);
  if (path) {
    await getSupabaseAdmin().storage.from(BUCKET).remove([path]);
  }
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
  if (!(await canAccessSite(siteId))) {
    return { error: "You do not have access to that site." };
  }

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
  return {};
}
