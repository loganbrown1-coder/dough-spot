"use server";

import { getCurrentUser, canManageCaptures } from "@/lib/auth";
import { reviewQualityAssessment, reviewIdentification } from "@/lib/data/qualityAssessments";
import type { QualityVerdict } from "@/lib/quality/schema";

/**
 * An agent/admin confirming or correcting the model's verdict on one
 * capture - the "review" step in QualityBadge. Gated the same way as
 * everything else that manages captures (agent/super_admin only), which
 * matches quality_assessments_update's own row level security policy (see
 * supabase/migrations/015_quality_assessments.sql) - this action is a thin
 * wrapper, the database is still the real enforcement.
 */
export async function reviewQualityAssessmentAction(
  assessmentId: string,
  humanVerdict: QualityVerdict
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can review a quality assessment." };
  }

  try {
    await reviewQualityAssessment(assessmentId, humanVerdict);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save review." };
  }
}

/**
 * An agent/admin confirming or correcting the model's menu item
 * identification guess (see quality_assessments.identified_menu_item_id) -
 * the accuracy signal for the identification feature. This only records
 * whether the guess was right; if it was wrong, retagging the capture
 * itself is the existing, separate updateCaptureMenuItemAction (the
 * MenuItemSelect dropdown already on every tile).
 */
export async function reviewIdentificationAction(
  assessmentId: string,
  correct: boolean
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!canManageCaptures(user.role)) {
    return { error: "Only OpSpot agents and admins can review an identification." };
  }

  try {
    await reviewIdentification(assessmentId, correct);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save review." };
  }
}
