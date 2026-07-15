"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { createOrganisation } from "@/lib/data/organisations";
import { createBrand, getBrand } from "@/lib/data/brands";
import { createSite, getSite } from "@/lib/data/sites";
import { createMenuItem } from "@/lib/data/menuItems";
import type { Role } from "@/types";

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

  await createOrganisation(name);
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
  if (!photo.type.startsWith("image/")) {
    return { error: "The reference photo must be an image." };
  }
  if (!(await getBrand(brandId))) return { error: "Unknown brand." };

  const admin = getSupabaseAdmin();
  const parts = photo.name.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "jpg";
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
  await requireSuperAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;

  if (!email || !INVITABLE_ROLES.includes(role)) {
    return { error: "Email and a valid role are required." };
  }

  let brandId: string | null = null;
  let siteId: string | null = null;

  if (role === "ops") {
    brandId = String(formData.get("brandId") ?? "") || null;
    if (!brandId) return { error: "Brand is required for an ops manager." };
    if (!(await getBrand(brandId))) return { error: "Unknown brand." };
  } else if (role === "site_manager") {
    siteId = String(formData.get("siteId") ?? "") || null;
    if (!siteId) return { error: "Site is required for a site manager." };
    if (!(await getSite(siteId))) return { error: "Unknown site." };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl(),
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
