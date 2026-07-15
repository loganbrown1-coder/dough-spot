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
 * Batch-signs every distinct object path behind a set of stored URLs in
 * one request. Uses the service-role client, since a private bucket's
 * storage.objects has no policies of its own for the anon/user client to
 * satisfy - safe here because every caller already scoped *which rows*
 * it's signing via row level security on the owning table (captures,
 * menu_items) before calling this; signing itself never decides who can
 * see what, only how the browser fetches what they're already allowed to.
 */
export async function signStoredUrls(
  bucket: string,
  storedUrls: (string | null)[]
): Promise<Map<string, string>> {
  const paths = Array.from(
    new Set(
      storedUrls
        .map((url) => (url ? objectPathFromStoredUrl(bucket, url) : null))
        .filter((path): path is string => Boolean(path))
    )
  );
  if (paths.length === 0) return new Map();

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS);
  if (error) throw error;

  const map = new Map<string, string>();
  (data ?? []).forEach((entry, i) => {
    if (entry.signedUrl) map.set(paths[i], entry.signedUrl);
  });
  return map;
}

/** Signs a single stored URL, or returns it unchanged if it can't be parsed. */
export async function signStoredUrl(bucket: string, storedUrl: string): Promise<string> {
  const signed = await signStoredUrls(bucket, [storedUrl]);
  const path = objectPathFromStoredUrl(bucket, storedUrl);
  return (path && signed.get(path)) || storedUrl;
}
