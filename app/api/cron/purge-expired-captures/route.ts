import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { objectPathFromStoredUrl } from "@/lib/storagePaths";

export const dynamic = "force-dynamic";

const BUCKET = "captures";

function cutoffDate(retentionDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - retentionDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Scheduled daily (see vercel.json) to delete photos past each
 * organisation's retention window (organisations.retention_days,
 * default 14 - set per-org from Admin > Organisations).
 *
 * Runs with no signed-in user (Vercel Cron has no session), so this uses
 * the service-role client throughout rather than the lib/data/* helpers,
 * which all assume an RLS-scoped user session.
 *
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
 * cron-triggered requests once CRON_SECRET is set as an env var - see
 * .env.local.example. Fails closed if it isn't configured.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: organisations, error: orgError } = await admin
    .from("organisations")
    .select("id, retention_days");
  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  const byOrganisation: Record<string, number> = {};
  let totalDeleted = 0;

  for (const org of organisations ?? []) {
    const { data: brands } = await admin
      .from("brands")
      .select("id")
      .eq("organisation_id", org.id);
    const brandIds = (brands ?? []).map((b) => b.id);
    if (brandIds.length === 0) continue;

    const { data: sites } = await admin.from("sites").select("id").in("brand_id", brandIds);
    const siteIds = (sites ?? []).map((s) => s.id);
    if (siteIds.length === 0) continue;

    const { data: expired, error: expiredError } = await admin
      .from("captures")
      .select("id, site_id, date, day_part_id, sequence, image_url")
      .in("site_id", siteIds)
      .lt("date", cutoffDate(org.retention_days));
    if (expiredError || !expired || expired.length === 0) continue;

    const { error: deleteError } = await admin
      .from("captures")
      .delete()
      .in(
        "id",
        expired.map((c) => c.id)
      );
    if (deleteError) continue;

    const paths = expired
      .map((c) => objectPathFromStoredUrl(BUCKET, c.image_url))
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await admin.storage.from(BUCKET).remove(paths);
    }

    await admin.from("capture_events").insert(
      expired.map((c) => ({
        site_id: c.site_id,
        date: c.date,
        day_part_id: c.day_part_id,
        sequence: c.sequence,
        capture_id: null,
        actor_id: null,
        actor_email: "system",
        action: "purge",
        detail: `Retention: ${org.retention_days} days`,
      }))
    );

    byOrganisation[org.id] = expired.length;
    totalDeleted += expired.length;
  }

  return NextResponse.json({ ok: true, totalDeleted, byOrganisation });
}
