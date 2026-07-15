export type Role = "super_admin" | "agent" | "ops" | "site_manager";
export type CaptureSource = "manual" | "automated";

export interface Organisation {
  id: string;
  name: string;
  retentionDays: number;
}

export interface Brand {
  id: string;
  organisationId: string;
  name: string;
}

export interface Site {
  id: string;
  brandId: string;
  name: string;
}

export interface DayPart {
  id: string; // 'A' | 'B' | 'C'
  label: string;
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
}

export interface MenuItem {
  id: string;
  brandId: string;
  name: string;
  referenceImageUrl: string | null;
  createdAt: string;
}

export interface Capture {
  id: string;
  siteId: string;
  date: string; // 'YYYY-MM-DD'
  dayPartId: string;
  sequence: number; // 1-3
  imageUrl: string;
  capturedAt: string; // ISO timestamp
  source: CaptureSource;
  menuItemId: string | null;
  rating: number | null; // 1-5
  flagged: boolean;
  flagComment: string | null;
  flaggedBy: string | null;
  flaggedAt: string | null;
}

export type CaptureEventAction =
  | "upload"
  | "replace"
  | "delete"
  | "clear_day_part"
  | "rate"
  | "flag"
  | "resolve_flag"
  | "purge";

export interface CaptureEvent {
  id: string;
  siteId: string;
  date: string;
  dayPartId: string;
  sequence: number;
  captureId: string | null;
  actorId: string | null;
  actorEmail: string;
  action: CaptureEventAction;
  detail: string | null;
  createdAt: string;
}

/**
 * One row per Supabase Auth user (profiles.id === auth.users.id).
 * Authentication itself - password, sessions - is handled entirely by
 * Supabase Auth; this only carries the role and scope. Exactly one of
 * organisationId/brandId/siteId is set, depending on role:
 *   super_admin  -> all null (OpSpot's own admin, sees and manages everything)
 *   agent        -> all null (OpSpot's own uploader - uploads/replaces/
 *                   deletes/rates photos for any customer, no admin access)
 *   ops          -> brandId set (customer, sees every site under that
 *                   brand - view-only, plus can flag a photo)
 *   site_manager -> siteId set (customer, sees that one site - view-only,
 *                   plus can flag a photo)
 */
export interface Profile {
  id: string;
  email: string;
  role: Role;
  organisationId: string | null;
  brandId: string | null;
  siteId: string | null;
  disabled: boolean;
  createdAt: string;
}
