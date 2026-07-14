export type Role = "super_admin" | "org_admin" | "ops" | "site_manager";
export type CaptureSource = "manual" | "automated";

export interface Organisation {
  id: string;
  name: string;
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
}

/**
 * One row per Supabase Auth user (profiles.id === auth.users.id).
 * Authentication itself - password, sessions - is handled entirely by
 * Supabase Auth; this only carries the role and scope. Exactly one of
 * organisationId/brandId/siteId is set, depending on role:
 *   super_admin  -> all null (sees every organisation)
 *   org_admin    -> organisationId set (sees every brand/site in that org)
 *   ops          -> brandId set (sees every site under that brand)
 *   site_manager -> siteId set (sees that one site)
 */
export interface Profile {
  id: string;
  email: string;
  role: Role;
  organisationId: string | null;
  brandId: string | null;
  siteId: string | null;
  createdAt: string;
}
