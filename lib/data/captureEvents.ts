import { createClient } from "@/lib/db/supabase-server";
import type { CaptureEvent, CaptureEventAction } from "@/types";

function rowToEvent(row: {
  id: string;
  site_id: string;
  date: string;
  day_part_id: string;
  sequence: number;
  capture_id: string | null;
  actor_id: string | null;
  actor_email: string;
  action: string;
  detail: string | null;
  created_at: string;
}): CaptureEvent {
  return {
    id: row.id,
    siteId: row.site_id,
    date: row.date,
    dayPartId: row.day_part_id,
    sequence: row.sequence,
    captureId: row.capture_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action as CaptureEventAction,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

/**
 * Appends one row to the audit trail. Callers treat this as best-effort -
 * a logging failure should never block the upload/edit/delete it's
 * describing, so lib/actions/captures.ts always wraps this in a
 * try/catch rather than letting it fail the user-facing action.
 */
export async function logCaptureEvent(params: {
  siteId: string;
  date: string;
  dayPartId: string;
  sequence: number;
  captureId: string | null;
  actorId: string | null;
  actorEmail: string;
  action: CaptureEventAction;
  detail?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("capture_events").insert({
    site_id: params.siteId,
    date: params.date,
    day_part_id: params.dayPartId,
    sequence: params.sequence,
    capture_id: params.captureId,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    detail: params.detail ?? null,
  });
  if (error) throw error;
}

/** The activity log for one site/date, newest first - the admin "Activity" tab. */
export async function listCaptureEvents(params: {
  siteId: string;
  date: string;
}): Promise<CaptureEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capture_events")
    .select("*")
    .eq("site_id", params.siteId)
    .eq("date", params.date)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToEvent);
}

/**
 * Used by deleteSiteAction - a site can have audit history (capture_events)
 * even with zero current captures, e.g. every past photo was later
 * replaced or cleared. capture_events.site_id is "on delete restrict" the
 * same as captures, so this has to be checked independently of
 * countCapturesForSite rather than assumed to be zero whenever captures
 * are.
 */
export async function countCaptureEventsForSite(siteId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("capture_events")
    .select("*", { count: "exact", head: true })
    .eq("site_id", siteId);
  if (error) throw error;
  return count ?? 0;
}
