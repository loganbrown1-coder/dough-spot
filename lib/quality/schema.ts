/**
 * Scoring schema for automated pizza quality assessment, based on
 * Fireaway's "Taste or Waste" grading guide. See
 * docs/pizza-quality-scoring.md for the rubric this was built from and the
 * reasoning behind it.
 */

export type QualityAxis = "spec" | "neat" | "heat" | "stretch";

/**
 * Controlled defect vocabulary, one list per axis, pulled directly from the
 * guide's "Waste" column. Fixed codes (rather than free text) keep model
 * output consistent across calls and make it possible to aggregate later -
 * e.g. "which sites get flagged for no_leopard_spotting most often."
 */
export const DEFECT_CODES = {
  spec: [
    "incorrect_sauce_amount",
    "incorrect_cheese_amount",
    "incorrect_toppings",
    "incorrect_topping_quantity",
    "uneven_topping_distribution",
    "centre_overloaded",
    "edges_bare",
    "ingredient_gaps",
  ],
  neat: [
    "doesnt_fit_box",
    "box_not_clean",
    "burnt_flakes_visible",
    "excess_flour_on_crust",
    "uneven_slices",
    "unattractive_presentation",
    "no_dip_visible",
  ],
  heat: [
    "no_leopard_spotting",
    "excessive_charring",
    "burnt_crust",
    "no_char_appearance",
    "doughy_undercooked_base",
    "cheese_unmelted_or_uneven",
    "greasy_surface",
  ],
  stretch: [
    "under_or_over_proofed",
    "misshapen",
    "inconsistent_dough_thickness",
    "dense_flat_centre",
    "incorrect_size",
    "holes_or_thin_patches",
  ],
} as const satisfies Record<QualityAxis, readonly string[]>;

export type DefectCode<A extends QualityAxis = QualityAxis> = (typeof DEFECT_CODES)[A][number];

export interface AxisScore<A extends QualityAxis = QualityAxis> {
  score: 1 | 2 | 3 | 4 | 5; // 5 = fully on spec, 1 = clear fail
  defects: DefectCode<A>[]; // empty if none observed
  notes: string;
}

export type QualityVerdict = "pass" | "fail" | "borderline";
export type QualityConfidence = "high" | "medium" | "low";

// Note: fields below use the unparametrised AxisScore (defects typed as the
// union of every axis's codes), not AxisScore<"spec"> etc. - assessCapture's
// validateAxis() has one shared shape to fill in for whichever axis it's
// given, and narrowing per field here would fight that rather than help,
// since the union is still a closed set of exactly these codes. Which axis
// a given code actually belongs to isn't tracked in the type, only enforced
// at runtime by validateAxis checking against DEFECT_CODES[axis].
export interface QualityAssessment {
  spec: AxisScore;
  neat: AxisScore;
  heat: AxisScore;
  stretch: AxisScore;
  overallScore: 1 | 2 | 3 | 4 | 5; // holistic, not just an average of the four
  verdict: QualityVerdict;
  // "low" is the escape hatch for photos the model genuinely can't judge
  // (bad lighting, obscured angle, box already closed) - treat this the
  // same as "borderline" for auto-flagging purposes regardless of verdict.
  confidence: QualityConfidence;
  summary: string;
  // Set only when the call included reference photos to identify against
  // (see assessCapture's referenceItems param and
  // lib/data/menuItems.ts#getMenuItemReferences) - null otherwise, which is
  // the normal case until a brand has reference photos for its menu items.
  // identifiedMenuItemName is one of the candidate names passed in, or
  // "unclear" if the model genuinely couldn't tell - both cases keep
  // identifiedMenuItemId null (name-to-id resolution happens in
  // assessCapture, which is the only place that knows the candidate list).
  identifiedMenuItemId: string | null;
  identifiedMenuItemName: string | null;
  identificationConfidence: QualityConfidence | null;
}

/** One row from quality_assessments, as stored - see supabase/migrations/015_quality_assessments.sql. */
export interface QualityAssessmentRecord extends QualityAssessment {
  id: string;
  captureId: string;
  model: string;
  humanReviewed: boolean;
  humanVerdict: QualityVerdict | null;
  // Whether a human has confirmed/corrected the identification above (a
  // separate step from humanVerdict/human_reviewed, which is about the
  // quality score, not the identity guess) - see
  // reviewIdentificationAction. identificationCorrect is null until
  // reviewed, then true/false.
  identificationReviewed: boolean;
  identificationCorrect: boolean | null;
  createdAt: string;
}
