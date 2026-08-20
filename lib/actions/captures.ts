"use server";

import { after } from "next/server";
import { getCurrentUser, canAccessSite, canManageCaptures } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import {
  listCaptures,
  getCapture,
  replaceCaptures,
  addCapture,
  updateCaptureMenuItem,
  updateCaptureImage,
  deleteCapture,
  deleteCapturesForDayPart,
  flagCapture,
  resolveFlag,
  type NewCaptureImage,
} from "@/lib/data/captures";
import { logCaptureEvent, listCaptureEvents } from "@/lib/data/captureEvents";
import { getDayPart } from "@/lib/data/dayParts";
import { getSite } from "@/lib/data/sites";
import { getBrand } from "@/lib/data/brands";
import { getMenuItem, getMenuItemReferences } from "@/lib/data/menuItems";
import { objectPathFromStoredUrl, thumbnailPathFor } from "@/lib/storagePaths";
import { imageExtension } from "@/lib/imageUpload";
import { assessCapture, QUALITY_MODEL } from "@/lib/quality/assessCapture";
import {
  saveQualityAssessment,
  getQualityScoringSpendThisMonth,
  QUALITY_SCORING_MONTHLY_CAP_USD,
} from "@/lib/data/qualityAssessments";
import type { Capture, CaptureEvent } from "@/types";

export interface UploadState {
  error?: string;
  success?: boolean;
}

const BUCKET = "captures";
const IMAGE_TYPE_ERROR = "Files must be JPEG, PNG, WebP, or GIF images.";

/**
 * Confirms dayPartId actually exists and belongs to the same organisation
 * as siteId - day parts are per-organisation now, so a mismatch would
 * otherwise silently create a capture whose day part belongs to a
 * different organisation than its site.
 */
async function dayPartMatchesSite(dayPartId: string, siteId: string): Promise<boolean> {
  const dayPart = await getDayPart(dayPartId);
  if (!dayPart) return false;

  const site = await getSite(siteId);
  if (!site) return false;
  const brand = await getBrand(site.brandId);
  if (!brand) return false;

  return dayPart.organisationId === brand.organisationId;
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

/**
 * Kicks off automated quality scoring (see lib/quality) for one newly
 * saved capture, without making the uploader wait on it - a vision model
 * call is a second or two, easily the slowest part of the request
 * otherwise. Wrapped in Next's after() rather than a bare unawaited
 * promise: on a serverless deployment (Vercel), the function instance can
 * be frozen the moment the response is sent, which would silently kill a
 * plain fire-and-forget async call before it finishes. after() explicitly
 * keeps the instance alive until this resolves.
 *
 * A no-op until ANTHROPIC_API_KEY is set (see .env.local.example) - lets
 * this ship without scoring suddenly turning on (and failing) for everyone
 * before the key exists.
 */
function scoreCaptureInBackground(capture: Capture, imageBuffer: Buffer, mimeType: string): void {
  if (!process.env.ANTHROPIC_API_KEY) return;
  after(async () => {
    try {
      // Checked fresh before every call, not cached - deliberately a live
      // read rather than an in-memory counter, since this runs in
      // per-request server functions with no shared process state, and
      // the DB is the only place multiple concurrent uploads could
      // otherwise race past the cap together.
      const spendSoFar = await getQualityScoringSpendThisMonth();
      if (spendSoFar >= QUALITY_SCORING_MONTHLY_CAP_USD) {
        console.warn(
          `Quality scoring skipped for capture ${capture.id}: monthly cap of $${QUALITY_SCORING_MONTHLY_CAP_USD} reached ($${spendSoFar.toFixed(2)} spent).`
        );
        return;
      }

      const menuItem = capture.menuItemId ? await getMenuItem(capture.menuItemId) : null;

      // Switches assessCapture into "identify and grade" mode once the
      // site's brand has reference photos for its menu items - a no-op
      // (empty array) until Fireaway populate any, at which point this
      // starts happening automatically, no separate rollout step needed.
      const site = await getSite(capture.siteId);
      const referenceItems = site ? await getMenuItemReferences(site.brandId) : [];

      const { assessment, inputTokens, outputTokens } = await assessCapture({
        imageBuffer,
        mimeType,
        menuItemName: menuItem?.name ?? null,
        referenceItems,
      });
      await saveQualityAssessment(capture.id, QUALITY_MODEL, assessment, { inputTokens, outputTokens });
    } catch (err) {
      // Best-effort, same as logEvent - a failed or misconfigured model
      // call must never affect the upload it's scoring.
      console.error("Quality assessment failed:", err);
    }
  });
}

/**
 * Uploads a thumbnail alongside a full-size object, if one was sent -
 * best-effort only. Thumbnails are a pure optimization (see
 * thumbnailPathFor/withSignedUrls): every read path already falls back to
 * the full image when no thumbnail exists, so a failure here must never
 * block or fail the actual photo upload it's attached to.
 */
async function uploadThumbnail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  objectPath: string,
  thumbnail: File | null
): Promise<void> {
  if (!thumbnail || thumbnail.size === 0) return;
  try {
    const buffer = Buffer.from(await thumbnail.arrayBuffer());
    await admin.storage
      .from(BUCKET)
      .upload(thumbnailPathFor(objectPath), buffer, {
        contentType: thumbnail.type || "image/jpeg",
        upsert: true,
      });
  } catch (err) {
    console.error("Failed to upload thumbnail:", err);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Invalid date." };
  }
  if (!(await canAccessSite(siteId))) {
    return { error: "You do not have access to that site." };
  }
  if (!(await dayPartMatchesSite(dayPartId, siteId))) {
    return { error: "Invalid day part for this site." };
  }

  const files: File[] = [];
  const menuItemIds: (string | null)[] = [];
  const comments: (string | null)[] = [];
  for (const key of ["photo1", "photo2", "photo3"]) {
    const file = formData.get(key);
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Please select all three photos." };
    }
    if (!imageExtension(file)) {
      return { error: IMAGE_TYPE_ERROR };
    }
    files.push(file);
    const menuItemId = String(formData.get(`menuItem${files.length}`) ?? "");
    menuItemIds.push(menuItemId || null);
    const comment = String(formData.get(`comment${files.length}`) ?? "").trim();
    comments.push(comment || null);
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
  // Kept in step with `images` (same index) so each saved capture's
  // sequence can be matched back to the bytes already read for it below -
  // scoring reuses these rather than re-fetching the file from Storage.
  const buffers: Buffer[] = [];
  for (let i = 0; i < files.length; i++) {
    const sequence = i + 1;
    const file = files[i];
    // Already validated in the loop above that built `files`.
    const ext = imageExtension(file)!;
    const objectPath = `${folder}/${sequence}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    buffers.push(buffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType: file.type, upsert: true });
    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    const thumbnailEntry = formData.get(`thumbnail${sequence}`);
    await uploadThumbnail(supabase, objectPath, thumbnailEntry instanceof File ? thumbnailEntry : null);

    const { data: publicUrl } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(objectPath);

    images.push({
      sequence,
      imageUrl: withCacheBust(publicUrl.publicUrl),
      source: "manual",
      menuItemId: menuItemIds[i],
      comment: comments[i],
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
    scoreCaptureInBackground(capture, buffers[capture.sequence - 1], files[capture.sequence - 1].type);
  }

  return { success: true };
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
  file: File,
  thumbnail: File | null = null
): Promise<{ error?: string; imageUrl?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can replace a photo." };
  }
  if (!(await canAccessSite(siteId))) {
    return { error: "You do not have access to that site." };
  }
  const ext = imageExtension(file);
  if (!ext) return { error: IMAGE_TYPE_ERROR };

  const admin = getSupabaseAdmin();
  const folder = `${siteId}/${date}/${dayPartId}`;

  // The replacement may use a different extension than what's already
  // there, so clear anything at this sequence before writing the new file
  // - including its old thumbnail sibling ("1-thumb.jpg"), which wouldn't
  // otherwise match a plain "1." prefix check.
  const { data: existing } = await admin.storage.from(BUCKET).list(folder);
  const stale = (existing ?? []).filter(
    (f) => f.name.startsWith(`${sequence}.`) || f.name.startsWith(`${sequence}-thumb.`)
  );
  if (stale.length > 0) {
    await admin.storage.from(BUCKET).remove(stale.map((f) => `${folder}/${f.name}`));
  }

  const objectPath = `${folder}/${sequence}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  await uploadThumbnail(admin, objectPath, thumbnail);

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
    // Re-fetched rather than reusing what the caller passed in, since
    // scoring needs the row's current menuItemId - a replace doesn't change
    // it, but nothing upstream of this action carries it through.
    const updated = await getCapture(captureId);
    if (updated) scoreCaptureInBackground(updated, buffer, file.type);
    return { imageUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save photo." };
  }
}

/**
 * Adds a photo to one currently-empty slot in a partially-uploaded day
 * part, without requiring the other slots to be (re)provided - the gap
 * that previously forced someone with, say, only one new photo to submit
 * the same file three times just to satisfy uploadCapturesAction's "all
 * three or nothing" requirement.
 */
export async function addCaptureAction(
  siteId: string,
  date: string,
  dayPartId: string,
  sequence: number,
  file: File,
  thumbnail: File | null = null,
  comment: string | null = null
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can upload a photo." };
  }
  if (!(await canAccessSite(siteId))) {
    return { error: "You do not have access to that site." };
  }
  const ext = imageExtension(file);
  if (!ext) return { error: IMAGE_TYPE_ERROR };

  const admin = getSupabaseAdmin();
  const objectPath = `${siteId}/${date}/${dayPartId}/${sequence}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  await uploadThumbnail(admin, objectPath, thumbnail);

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  const imageUrl = withCacheBust(publicUrl.publicUrl);

  try {
    const saved = await addCapture({
      siteId,
      date,
      dayPartId,
      image: { sequence, imageUrl, source: "manual", menuItemId: null, comment },
    });
    await logEvent({
      siteId,
      date,
      dayPartId,
      sequence,
      captureId: saved.id,
      actorId: user.id,
      actorEmail: user.email,
      action: "upload",
    });
    scoreCaptureInBackground(saved, buffer, file.type);
    return {};
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

  // Fetched through the RLS-scoped client (not the admin client) so that a
  // captureId belonging to a site outside the caller's access returns null
  // here and short-circuits before any storage object gets touched. The
  // storage deletion below uses the admin client because Storage has no
  // RLS policies of its own - this lookup is what stands in for that.
  const row = await getCapture(captureId);
  if (!row) return { error: "Photo not found." };

  try {
    await deleteCapture(captureId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete photo." };
  }

  const admin = getSupabaseAdmin();
  const path = objectPathFromStoredUrl(BUCKET, row.imageUrl);
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
