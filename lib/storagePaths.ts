import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

/**
 * Uploads always write through supabase.storage.from(bucket).getPublicUrl(),
 * even though both buckets are private - that call is just string
 * templating, so it still gives us a stable, parseable path carrier to
 * store on the row. The URL itself never resolves directly; every read
 * re-derives the object path from it and signs a fresh one (see
 * signStoredUrls below).
 */
export function objectPathFromStoredUrl(bucket: string, storedUrl: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = storedUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = storedUrl.slice(idx + marker.length).split("?")[0];
  return decodeURIComponent(path);
}

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour - long enough to outlast a page view.

/**
 * The small grid-thumbnail sibling of a full-size object path, e.g.
 * "site/date/dayPart/1.jpg" -> "site/date/dayPart/1-thumb.jpg". A pure
 * naming convention, not a stored value - there's nothing to migrate, and
 * a path with no matching object just fails to sign (see signObjectPaths),
 * which callers treat as "no thumbnail yet, use the full image."
 */
export function thumbnailPathFor(objectPath: string): string {
  const dot = objectPath.lastIndexOf(".");
  if (dot === -1) return `${objectPath}-thumb`;
  return `${objectPath.slice(0, dot)}-thumb${objectPath.slice(dot)}`;
}

/**
 * Batch-signs raw object paths directly. Uses the service-role client,
 * since a private bucket's storage.objects has no policies of its own for
 * the anon/user client to satisfy - safe here because every caller already
 * scoped *which rows* it's signing via row level security on the owning
 * table (captures, menu_items) before calling this; signing itself never
 * decides who can see what, only how the browser fetches what they're
 * already allowed to. A path with no matching object comes back with
 * entry.error set and no signedUrl (verified directly against Supabase
 * rather than assumed) - silently omitted from the returned map, which is
 * exactly what lets thumbnailPathFor's fallback work for photos uploaded
 * before thumbnails existed.
 */
export async function signObjectPaths(
  bucket: string,
  paths: string[]
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(paths));
  if (uniquePaths.length === 0) return new Map();

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, SIGNED_URL_EXPIRY_SECONDS);
  if (error) throw error;

  const map = new Map<string, string>();
  (data ?? []).forEach((entry, i) => {
    if (entry.signedUrl) map.set(uniquePaths[i], entry.signedUrl);
  });
  return map;
}

/** Resolves stored (unsigned) "public URL" style strings to signed ones. */
export async function signStoredUrls(
  bucket: string,
  storedUrls: (string | null)[]
): Promise<Map<string, string>> {
  const paths = storedUrls
    .map((url) => (url ? objectPathFromStoredUrl(bucket, url) : null))
    .filter((path): path is string => Boolean(path));
  return signObjectPaths(bucket, paths);
}

/** Signs a single stored URL, or returns it unchanged if it can't be parsed. */
export async function signStoredUrl(bucket: string, storedUrl: string): Promise<string> {
  const signed = await signStoredUrls(bucket, [storedUrl]);
  const path = objectPathFromStoredUrl(bucket, storedUrl);
  return (path && signed.get(path)) || storedUrl;
}
