"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { createOrganisation, getOrganisation, updateOrganisationRetention } from "@/lib/data/organisations";
import { createBrand, getBrand, updateBrandName } from "@/lib/data/brands";
import { createSite, getSite, updateSiteName } from "@/lib/data/sites";
import { createMenuItem, updateMenuItemName } from "@/lib/data/menuItems";
import {
  createDayPart,
  updateDayPart,
  deleteDayPart,
  listDayPartsByOrganisation,
} from "@/lib/data/dayParts";
import { countCapturesForDayPart } from "@/lib/data/captures";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { imageExtension } from "@/lib/imageUpload";
import type { Role } from "@/types";

const MAX_DAY_PARTS = 6;

// Every organisation starts with these, matching what the app used to
// share globally before day parts became per-organisation - editable
// afterwards from the same tab (see createDayPartAction etc. below).
const DEFAULT_DAY_PARTS = [
  { label: "Day Part A", startTime: "11:00", endTime: "16:00" },
  { label: "Day Part B", startTime: "16:00", endTime: "21:00" },
  { label: "Day Part C", startTime: "21:00", endTime: "23:00" },
];

export interface AdminFormState {
  error?: string;
  success?: boolean;
}

function redirectUrl(): string {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/auth/callback`;
}

/**
 * Creates an empty organisation shell. There's no customer-side admin
 * tier to invite alongside it any more - OpSpot (super_admin/agent) adds
 * the brands, sites, and menu items, then invites ops/site_manager users
 * directly once sites exist.
 */
export async function createOrganisationAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Organisation name is required." };

  const org = await createOrganisation(name);
  for (const dayPart of DEFAULT_DAY_PARTS) {
    await createDayPart({ organisationId: org.id, ...dayPart });
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function createBrandAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireSuperAdmin();

  const organisationId = String(formData.get("organisationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!organisationId || !name) {
    return { error: "Organisation and brand name are required." };
  }

  await createBrand(organisationId, name);
  revalidatePath("/admin");
  return { success: true };
}

export async function createSiteAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireSuperAdmin();

  const brandId = String(formData.get("brandId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!brandId || !name) {
    return { error: "Brand and site name are required." };
  }
  if (!(await getBrand(brandId))) return { error: "Unknown brand." };

  await createSite(brandId, name);
  revalidatePath("/admin");
  return { success: true };
}

export async function createMenuItemAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireSuperAdmin();

  const brandId = String(formData.get("brandId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const photo = formData.get("referenceImage");

  if (!brandId || !name) {
    return { error: "Brand and menu item name are required." };
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "A reference photo is required." };
  }
  const ext = imageExtension(photo);
  if (!ext) {
    return { error: "The reference photo must be a JPEG, PNG, WebP, or GIF image." };
  }
  if (!(await getBrand(brandId))) return { error: "Unknown brand." };

  const admin = getSupabaseAdmin();
  const objectPath = `${brandId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("menu-items")
    .upload(objectPath, buffer, { contentType: photo.type });
  if (uploadError) return { error: `Photo upload failed: ${uploadError.message}` };

  const { data: publicUrl } = admin.storage.from("menu-items").getPublicUrl(objectPath);

  await createMenuItem({
    brandId,
    name,
    referenceImageUrl: publicUrl.publicUrl,
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function renameBrandAction(
  id: string,
  name: string
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (!name.trim()) return { error: "Name can't be empty." };

  try {
    await updateBrandName(id, name.trim());
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to rename brand." };
  }
}

export async function renameSiteAction(
  id: string,
  name: string
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (!name.trim()) return { error: "Name can't be empty." };

  try {
    await updateSiteName(id, name.trim());
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to rename site." };
  }
}

export async function renameMenuItemAction(
  id: string,
  name: string
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (!name.trim()) return { error: "Name can't be empty." };

  try {
    await updateMenuItemName(id, name.trim());
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to rename menu item." };
  }
}

function validateDayPartTimes(startTime: string, endTime: string): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    return "Times must be in HH:MM format.";
  }
  return null;
}

export interface DayPartFormState {
  error?: string;
  success?: boolean;
}

export async function createDayPartAction(
  _prevState: DayPartFormState,
  formData: FormData
): Promise<DayPartFormState> {
  await requireSuperAdmin();

  const organisationId = String(formData.get("organisationId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");

  if (!organisationId || !label) return { error: "Label is required." };
  const timeError = validateDayPartTimes(startTime, endTime);
  if (timeError) return { error: timeError };

  const existing = await listDayPartsByOrganisation(organisationId);
  if (existing.length >= MAX_DAY_PARTS) {
    return { error: `An organisation can have at most ${MAX_DAY_PARTS} day parts.` };
  }

  await createDayPart({ organisationId, label, startTime, endTime });
  revalidatePath("/admin");
  return { success: true };
}

export async function updateDayPartAction(
  id: string,
  label: string,
  startTime: string,
  endTime: string
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (!label.trim()) return { error: "Label can't be empty." };
  const timeError = validateDayPartTimes(startTime, endTime);
  if (timeError) return { error: timeError };

  try {
    await updateDayPart(id, { label: label.trim(), startTime, endTime });
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update day part." };
  }
}

/**
 * Refuses to go below 1 day part for an organisation, and refuses to
 * remove one that already has photos against it (captures.day_part_id is
 * "on delete restrict" at the database level too - this just gives a
 * clearer error than the raw foreign key violation).
 */
export async function deleteDayPartAction(
  id: string,
  organisationId: string
): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const existing = await listDayPartsByOrganisation(organisationId);
  if (existing.length <= 1) {
    return { error: "An organisation must have at least 1 day part." };
  }

  const captureCount = await countCapturesForDayPart(id);
  if (captureCount > 0) {
    return {
      error: `Can't remove — ${captureCount} photo${captureCount === 1 ? "" : "s"} exist under this day part.`,
    };
  }

  try {
    await deleteDayPart(id);
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to remove day part." };
  }
}

/** How long a photo is kept before the scheduled purge job deletes it. */
export async function updateOrganisationRetentionAction(
  id: string,
  retentionDays: number
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    return { error: "Retention must be a whole number of days, at least 1." };
  }

  try {
    await updateOrganisationRetention(id, retentionDays);
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update retention." };
  }
}

const INVITABLE_ROLES: Role[] = ["super_admin", "agent", "ops", "site_manager"];

/**
 * Invites a brand-new Supabase Auth user by email (they set their own
 * password via the emailed link) and creates their profiles row in the
 * same step. This necessarily runs on the service-role client - the
 * Supabase Auth admin API can't be called with a regular user session.
 * Only a super_admin can reach this action at all (requireSuperAdmin
 * below), so there's no further per-organisation scoping to check.
 */
export async function inviteUserAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const inviter = await requireSuperAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;

  if (!email || !INVITABLE_ROLES.includes(role)) {
    return { error: "Email and a valid role are required." };
  }

  let brandId: string | null = null;
  let siteId: string | null = null;
  // Scope this invite's role covers, in human terms - shown in the invite
  // email so the recipient knows what they're accepting before they click.
  // Empty for agent/super_admin, who aren't scoped to a customer org.
  let scopeLabel = "";

  if (role === "ops") {
    brandId = String(formData.get("brandId") ?? "") || null;
    if (!brandId) return { error: "Brand is required for an ops manager." };
    const brand = await getBrand(brandId);
    if (!brand) return { error: "Unknown brand." };
    const org = await getOrganisation(brand.organisationId);
    scopeLabel = org ? `${org.name} — ${brand.name}` : brand.name;
  } else if (role === "site_manager") {
    siteId = String(formData.get("siteId") ?? "") || null;
    if (!siteId) return { error: "Site is required for a site manager." };
    const site = await getSite(siteId);
    if (!site) return { error: "Unknown site." };
    const brand = await getBrand(site.brandId);
    const org = brand ? await getOrganisation(brand.organisationId) : null;
    scopeLabel = org ? `${org.name} — ${site.name}` : site.name;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl(),
    // Surfaced in the invite email template via {{ .Data.* }}, so the
    // recipient sees who invited them and what they're being invited to
    // before clicking through - see supabase/email-templates/invite.html.
    data: {
      invited_by: inviter.email,
      role_label: ROLE_LABELS[role],
      scope_label: scopeLabel,
    },
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Failed to invite user." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    email,
    role,
    organisation_id: null,
    brand_id: role === "ops" ? brandId : null,
    site_id: role === "site_manager" ? siteId : null,
  });
  if (profileError) {
    // Undo the auth user so a retry isn't blocked by "already registered".
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Changes an existing user's role and scope - e.g. promoting a
 * site_manager to ops, or moving them to a different site.
 */
export async function updateUserRoleAction(
  userId: string,
  role: Role,
  scopeId: string | null
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (!INVITABLE_ROLES.includes(role)) return { error: "Invalid role." };

  let brandId: string | null = null;
  let siteId: string | null = null;

  if (role === "ops") {
    if (!scopeId) return { error: "Brand is required for an ops manager." };
    if (!(await getBrand(scopeId))) return { error: "Unknown brand." };
    brandId = scopeId;
  } else if (role === "site_manager") {
    if (!scopeId) return { error: "Site is required for a site manager." };
    if (!(await getSite(scopeId))) return { error: "Unknown site." };
    siteId = scopeId;
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ role, organisation_id: null, brand_id: brandId, site_id: siteId })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {};
}

/**
 * Deactivates a user - e.g. someone who's left. Bans them in Supabase
 * Auth (so a valid session/token stops working) and marks the profile
 * disabled (checked again at session time in lib/auth.ts). Reversible -
 * see reactivateUserAction.
 */
export async function deactivateUserAction(userId: string): Promise<{ error?: string }> {
  const actor = await requireSuperAdmin();
  if (userId === actor.id) return { error: "You can't deactivate your own account." };

  const admin = getSupabaseAdmin();

  // Set the profile flag first, so a failure here (e.g. migration
  // 004 not run yet) leaves no side effect at all, rather than a user
  // who's banned in Auth but not marked disabled.
  const { error } = await admin.from("profiles").update({ disabled: true }).eq("id", userId);
  if (error) return { error: error.message };

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h", // ~100 years - effectively permanent until reactivated
  });
  if (banError) return { error: banError.message };

  revalidatePath("/admin");
  return {};
}

export async function reactivateUserAction(userId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();

  const admin = getSupabaseAdmin();

  const { error } = await admin.from("profiles").update({ disabled: false }).eq("id", userId);
  if (error) return { error: error.message };

  const { error: unbanError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (unbanError) return { error: unbanError.message };

  revalidatePath("/admin");
  return {};
}

/**
 * Permanently removes a user - deletes their profile row and their
 * Supabase Auth account entirely. Unlike deactivate, this can't be
 * undone. capture_events.actor_id references are preserved (set to null
 * via ON DELETE SET NULL) so the audit log still reads correctly.
 */
export async function removeUserAction(userId: string): Promise<{ error?: string }> {
  const actor = await requireSuperAdmin();
  if (userId === actor.id) return { error: "You can't remove your own account." };

  const admin = getSupabaseAdmin();
  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) return { error: profileError.message };

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { error: authError.message };

  revalidatePath("/admin");
  return {};
}
