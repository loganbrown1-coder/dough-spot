import { createClient } from "@/lib/db/supabase-server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import {
  MODEL_PRICE_PER_INPUT_TOKEN,
  MODEL_PRICE_PER_OUTPUT_TOKEN,
} from "@/lib/quality/assessCapture";
import type { AxisScore, QualityAssessment, QualityAssessmentRecord } from "@/lib/quality/schema";

/**
 * Trusts the stored defect strings rather than re-validating them against
 * DEFECT_CODES on the way out - they were already validated once, on the
 * way in, by assessCapture's validateAxis() before saveQualityAssessment
 * ever wrote them.
 */
function rowToAxisScore(score: number, defects: string[], notes: string): AxisScore {
  return { score: score as 1 | 2 | 3 | 4 | 5, defects: defects as AxisScore["defects"], notes };
}

function rowToRecord(row: {
  id: string;
  capture_id: string;
  model: string;
  spec_score: number;
  spec_defects: string[];
  spec_notes: string;
  neat_score: number;
  neat_defects: string[];
  neat_notes: string;
  heat_score: number;
  heat_defects: string[];
  heat_notes: string;
  stretch_score: number;
  stretch_defects: string[];
  stretch_notes: string;
  overall_score: number;
  verdict: string;
  confidence: string;
  summary: string;
  human_reviewed: boolean;
  human_verdict: string | null;
  identified_menu_item_id: string | null;
  identified_menu_item_name: string | null;
  identification_confidence: string | null;
  identification_reviewed: boolean;
  identification_correct: boolean | null;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}): QualityAssessmentRecord {
  return {
    id: row.id,
    captureId: row.capture_id,
    model: row.model,
    spec: rowToAxisScore(row.spec_score, row.spec_defects, row.spec_notes),
    neat: rowToAxisScore(row.neat_score, row.neat_defects, row.neat_notes),
    heat: rowToAxisScore(row.heat_score, row.heat_defects, row.heat_notes),
    stretch: rowToAxisScore(row.stretch_score, row.stretch_defects, row.stretch_notes),
    overallScore: row.overall_score as 1 | 2 | 3 | 4 | 5,
    verdict: row.verdict as QualityAssessmentRecord["verdict"],
    confidence: row.confidence as QualityAssessmentRecord["confidence"],
    summary: row.summary,
    humanReviewed: row.human_reviewed,
    humanVerdict: row.human_verdict as QualityAssessmentRecord["humanVerdict"],
    identifiedMenuItemId: row.identified_menu_item_id,
    // Prefer resolving the id against the live menu_items list at display
    // time (see CaptureTile) over trusting this raw string, since a menu
    // item can be renamed after the fact - this column is really only
    // load-bearing for the "unclear"/unmatched case, where there's no id to
    // resolve at all.
    identifiedMenuItemName: row.identified_menu_item_name,
    identificationConfidence: row.identification_confidence as QualityAssessmentRecord["identificationConfidence"],
    identificationReviewed: row.identification_reviewed,
    identificationCorrect: row.identification_correct,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at,
  };
}

/**
 * Written via the service-role client, not the RLS-scoped one - this runs
 * from a background job (see lib/actions/captures.ts) triggered right after
 * a photo is saved, not as a direct user action, and there's deliberately
 * no insert policy on the table for the RLS-scoped client to satisfy (see
 * supabase/migrations/015_quality_assessments.sql).
 */
export async function saveQualityAssessment(
  captureId: string,
  model: string,
  assessment: QualityAssessment,
  usage: { inputTokens: number; outputTokens: number }
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("quality_assessments").insert({
    capture_id: captureId,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    spec_score: assessment.spec.score,
    spec_defects: assessment.spec.defects,
    spec_notes: assessment.spec.notes,
    neat_score: assessment.neat.score,
    neat_defects: assessment.neat.defects,
    neat_notes: assessment.neat.notes,
    heat_score: assessment.heat.score,
    heat_defects: assessment.heat.defects,
    heat_notes: assessment.heat.notes,
    stretch_score: assessment.stretch.score,
    stretch_defects: assessment.stretch.defects,
    stretch_notes: assessment.stretch.notes,
    overall_score: assessment.overallScore,
    verdict: assessment.verdict,
    confidence: assessment.confidence,
    summary: assessment.summary,
    identified_menu_item_id: assessment.identifiedMenuItemId,
    identified_menu_item_name: assessment.identifiedMenuItemName,
    identification_confidence: assessment.identificationConfidence,
  });
  if (error) throw error;
}

/** The monthly cap on quality-scoring spend - see getQualityScoringSpendThisMonth. */
export const QUALITY_SCORING_MONTHLY_CAP_USD = 20;

/**
 * Total dollar cost of every scoring call made so far this calendar month,
 * computed from the actual token counts stored on each row (not an
 * estimate). Checked before every new scoring call (see
 * scoreCaptureInBackground in lib/actions/captures.ts) so the feature can
 * never exceed QUALITY_SCORING_MONTHLY_CAP_USD regardless of what else the
 * Anthropic account is used for - workspace-level spend limits aren't
 * available on a prepaid-credit account, so this is enforced in the app
 * instead. Uses the service-role client, same as saveQualityAssessment -
 * this is an operational check, not a user-facing read scoped to any one
 * viewer's RLS permissions.
 */
export async function getQualityScoringSpendThisMonth(): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("quality_assessments")
    .select("input_tokens, output_tokens")
    .gte("created_at", startOfMonth.toISOString());
  if (error) throw error;

  return (data ?? []).reduce(
    (total, row) =>
      total +
      row.input_tokens * MODEL_PRICE_PER_INPUT_TOKEN +
      row.output_tokens * MODEL_PRICE_PER_OUTPUT_TOKEN,
    0
  );
}

/**
 * The most recent assessment for each capture in the given list, keyed by
 * capture id - used to annotate a grid of captures without one query per
 * tile. RLS-scoped (captures_select's own scoping is mirrored on this
 * table), so this only ever returns rows for captures the caller can see
 * anyway.
 */
export async function listLatestQualityAssessments(
  captureIds: string[]
): Promise<Map<string, QualityAssessmentRecord>> {
  if (captureIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quality_assessments")
    .select("*")
    .in("capture_id", captureIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const byCaptureId = new Map<string, QualityAssessmentRecord>();
  for (const row of data ?? []) {
    // First hit per capture_id wins - already ordered newest first.
    if (!byCaptureId.has(row.capture_id)) {
      byCaptureId.set(row.capture_id, rowToRecord(row));
    }
  }
  return byCaptureId;
}

/** An agent/admin confirming or correcting the model's verdict - the training signal captured in human_verdict. */
export async function reviewQualityAssessment(
  id: string,
  humanVerdict: "pass" | "fail" | "borderline"
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quality_assessments")
    .update({ human_reviewed: true, human_verdict: humanVerdict })
    .eq("id", id);
  if (error) throw error;
}

/**
 * An agent/admin confirming or correcting the model's identification guess
 * - a separate review from reviewQualityAssessment above, since agreeing
 * with the quality score and agreeing with which pizza it thinks this is
 * are independent judgements. Correcting the capture's actual menu item tag
 * (if the guess was wrong) is a distinct, existing action
 * (updateCaptureMenuItemAction) - this only records whether the guess
 * itself was right, which is the accuracy signal for the identification
 * feature specifically.
 */
export async function reviewIdentification(id: string, correct: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quality_assessments")
    .update({ identification_reviewed: true, identification_correct: correct })
    .eq("id", id);
  if (error) throw error;
}
