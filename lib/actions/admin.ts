"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin, requireSuperAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { createOrganisation, getOrganisation } from "@/lib/data/organisations";
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
 * Invites a brand-new Supabase Auth user by email (they set their own
 * password via the emailed link) and creates their profiles row in the
 * same step. This necessarily runs on the service-role client - the
 * Supabase Auth admin API can't be called with a regular user session -
 * so the authorization checks below (not RLS) are what stop an org_admin
 * from creating users outside their own organisation.
 */
export async function createOrganisationAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();

  if (!name || !adminEmail) {
    return { error: "Organisation name and an admin email are required." };
  }

  const organisation = await createOrganisation(name);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
    redirectTo: redirectUrl(),
  });
  if (error || !data.user) {
    return {
      error: `Organisation created, but inviting the admin failed: ${error?.message ?? "unknown error"}`,
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    email: adminEmail,
    role: "org_admin",
    organisation_id: organisation.id,
    brand_id: null,
    site_id: null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function createBrandAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await requireOrgAdmin();

  const organisationId = String(formData.get("organisationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!organisationId || !name) {
    return { error: "Organisation and brand name are required." };
  }
  if (actor.role === "org_admin" && organisationId !== actor.organisationId) {
    return { error: "You can only add brands to your own organisation." };
  }
  if (!(await getOrganisation(organisationId))) {
    return { error: "Unknown organisation." };
  }

  await createBrand(organisationId, name);
  revalidatePath("/admin");
  return { success: true };
}

export async function createSiteAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await requireOrgAdmin();

  const brandId = String(formData.get("brandId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!brandId || !name) {
    return { error: "Brand and site name are required." };
  }
  const brand = await getBrand(brandId);
  if (!brand) return { error: "Unknown brand." };
  if (actor.role === "org_admin" && brand.organisationId !== actor.organisationId) {
    return { error: "You can only add sites to your own organisation." };
  }

  await createSite(brandId, name);
  revalidatePath("/admin");
  return { success: true };
}

export async function createMenuItemAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await requireOrgAdmin();

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

  const brand = await getBrand(brandId);
  if (!brand) return { error: "Unknown brand." };
  if (actor.role === "org_admin" && brand.organisationId !== actor.organisationId) {
    return { error: "You can only add menu items to your own organisation." };
  }

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

const INVITABLE_ROLES: Role[] = ["super_admin", "org_admin", "ops", "site_manager"];

export async function inviteUserAction(
  _prevState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await requireOrgAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;

  if (!email || !INVITABLE_ROLES.includes(role)) {
    return { error: "Email and a valid role are required." };
  }
  if (role === "super_admin" && actor.role !== "super_admin") {
    return { error: "Only a super admin can create another super admin." };
  }

  let organisationId: string | null = null;
  let brandId: string | null = null;
  let siteId: string | null = null;
  // The organisation this new user's scope belongs to, used purely to
  // check an org_admin isn't reaching outside their own organisation -
  // not necessarily the value stored on the profile row.
  let targetOrganisationId: string | null = null;

  if (role === "org_admin") {
    organisationId = String(formData.get("organisationId") ?? "") || null;
    if (!organisationId) return { error: "Organisation is required for an org admin." };
    if (!(await getOrganisation(organisationId))) return { error: "Unknown organisation." };
    targetOrganisationId = organisationId;
  } else if (role === "ops") {
    brandId = String(formData.get("brandId") ?? "") || null;
    if (!brandId) return { error: "Brand is required for an ops user." };
    const brand = await getBrand(brandId);
    if (!brand) return { error: "Unknown brand." };
    targetOrganisationId = brand.organisationId;
  } else if (role === "site_manager") {
    siteId = String(formData.get("siteId") ?? "") || null;
    if (!siteId) return { error: "Site is required for a site manager." };
    const site = await getSite(siteId);
    if (!site) return { error: "Unknown site." };
    const brand = await getBrand(site.brandId);
    if (!brand) return { error: "Unknown brand." };
    targetOrganisationId = brand.organisationId;
  }

  if (
    actor.role === "org_admin" &&
    targetOrganisationId !== actor.organisationId
  ) {
    return { error: "You can only add users to your own organisation." };
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
    organisation_id: role === "org_admin" ? organisationId : null,
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
