/**
 * Every image upload path (capture photos, menu item reference photos)
 * validates against this allowlist rather than the looser
 * `file.type.startsWith("image/")`, which also accepts types like
 * image/svg+xml - SVGs can embed <script>, so accepting any declared
 * image/* MIME type risks stored XSS scoped to the storage domain if one
 * is ever opened directly rather than shown via <img>.
 */
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** The file's extension if it's an allowed image type, or null if it's rejected. */
export function imageExtension(file: File): string | null {
  return ALLOWED_IMAGE_TYPES[file.type] ?? null;
}

const EXTENSION_TO_MIME_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_IMAGE_TYPES).map(([mime, ext]) => [ext, mime])
);

/**
 * The inverse of imageExtension - used where a stored object path (e.g.
 * "brandId/menu-item.jpg") is all that's on hand and the original upload's
 * File/mimeType isn't, such as re-downloading a menu item's reference photo
 * for a quality-scoring call (see lib/data/menuItems.ts). Falls back to
 * image/jpeg for an unrecognised extension, matching assessCapture's own
 * fallback for the same situation.
 */
export function mimeTypeFromExtension(ext: string): string {
  return EXTENSION_TO_MIME_TYPE[ext.toLowerCase()] ?? "image/jpeg";
}
