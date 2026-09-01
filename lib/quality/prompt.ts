import { DEFECT_CODES } from "./schema";

/** The four-axis rubric itself - shared between both prompt modes below, so the grading criteria never drifts between them. */
const RUBRIC = `SPEC - Recipe accuracy
Pass looks like: correct cheese and sauce portion, correct toppings and quantities, toppings evenly distributed, no centre loading or bare edges.
Defect codes: ${DEFECT_CODES.spec.join(", ")}

NEAT - Presentation
Pass looks like: pizza fits the box with a small gap, box is clean, no burnt flakes or excess flour, cut into even slices, attractive overall.
Note: boxes are commonly lined with a printed greaseproof/wax paper - this is normal packaging, never read it as mess, debris, or a sign the box itself is dirty. Some photos show the pizza whole, before it has been sliced - if no cut lines are visible at all, do not judge slice evenness or count it as a defect; only assess slicing when slices are actually visible in the photo.
Defect codes: ${DEFECT_CODES.neat.join(", ")}

HEAT - Cooking quality
Pass looks like: leopard spotting on the crust, light char (not burnt), fully cooked base, cheese melted evenly, no greasy surface.
Defect codes: ${DEFECT_CODES.heat.join(", ")}

STRETCH - Dough shape and structure
Pass looks like: even round shape, consistent centre thickness, aerated crust (roughly 1-1.5in), reaches full size for the box, no holes or thin patches.
Defect codes: ${DEFECT_CODES.stretch.join(", ")}`;

/**
 * Shared judgment guardrails - not axis-specific rubric content (that's
 * RUBRIC above), but rules for what to do when the photo itself makes
 * judging hard. Added after real scored photos showed three repeat
 * failure modes: background kitchen clutter counted as a dirty box,
 * confident defect codes asserted on photos the model's own notes said
 * it couldn't properly see, and "doesn't fit box" flagged on photos with
 * no box in frame at all (pizza still on the peel). Shared between both
 * prompt modes so this doesn't drift between them.
 */
const JUDGING_GROUND_RULES = `Judge only what is visible in the photo. Do not guess at things you can't see (e.g. exact oven temperature, exact ingredient weights) - use the visual proxies the guide itself defines for those.

Judge only the pizza itself and its box. Ignore the surrounding kitchen environment - the counter, other equipment, packaging, or people visible in the background is never a presentation defect, however cluttered it looks.

If a criterion isn't visible in the photo at all - e.g. no box in frame at all (pizza on a peel, held in hand), so box fit can't be judged; no cut lines visible, so slice evenness can't be judged - skip that specific defect rather than guessing.

If a large portion of the pizza itself is out of frame, obstructed, or otherwise not clearly visible, set confidence to "low". An axis you genuinely can't assess should default to a mid-range score (3), not a low one - a low score means you observed a real defect, not that the photo made it hard to tell. A photo that's simply hard to see is a photography problem, not evidence the pizza is bad, and should not by itself push the verdict to "fail".`;

const SCORING_INSTRUCTIONS = `Score across four axes. For each, give a 1-5 score, a list of defect codes from the fixed list below (only include ones you actually observe - leave empty if none), and a note of one short, plain sentence - state what you saw, nothing more.

${RUBRIC}

Score generously - a 4 or 5 is the normal, expected result for an ordinary sellable pizza. Reserve 1-2 scores for defects clear and severe enough that a customer would genuinely complain, not small cosmetic imperfections. The same applies to the overall verdict: "fail" means a pizza you would not want served at all - a pizza with one minor, forgivable issue should land on "pass" or "borderline" instead, not "fail".

Then give an overallScore (1-5, your holistic judgement, not a mechanical average), a verdict of "pass", "fail", or "borderline", a confidence of "high", "medium", or "low" (use "low" whenever lighting, angle, or obstruction genuinely limits what you can judge), and a summary of one short, plain sentence.`;

const AXIS_JSON_SHAPE = `  "spec": { "score": 1-5, "defects": [...], "notes": "..." },
  "neat": { "score": 1-5, "defects": [...], "notes": "..." },
  "heat": { "score": 1-5, "defects": [...], "notes": "..." },
  "stretch": { "score": 1-5, "defects": [...], "notes": "..." },
  "overallScore": 1-5,
  "verdict": "pass" | "fail" | "borderline",
  "confidence": "high" | "medium" | "low",
  "summary": "..."`;

/**
 * Mode A - no reference photos available for this brand's menu items yet
 * (the normal case today - see getMenuItemReferences). Spec is judged
 * against the guide's general rules (even distribution, no centre loading,
 * no bare edges) rather than a specific recipe's exact build, using
 * whatever menu item tag the uploader already applied, if any.
 */
export function buildQualityPrompt(menuItemName: string | null): string {
  return `You are a QA inspector for Fireaway, assessing a single photo of a pizza against their internal "Taste or Waste" grading guide.

${JUDGING_GROUND_RULES}

${
  menuItemName
    ? `The pizza in this photo is tagged as: ${menuItemName}`
    : "No menu item tag is available for this photo - judge general presentation and technique rather than recipe-specific accuracy."
}

${SCORING_INSTRUCTIONS}

Respond with ONLY valid JSON matching this shape, no other text:

{
${AXIS_JSON_SHAPE}
}`;
}

/**
 * Mode B - the brand has reference photos for at least some menu items
 * (see getMenuItemReferences). Sent as a series of labelled reference
 * images followed by the unlabelled capture photo (assessCapture builds
 * that image sequence; this just writes the accompanying instructions).
 * Identifying the pizza first, then grading Spec against that specific
 * item's actual build, is the point - "correct toppings and quantities"
 * only means something once there's a concrete answer for what "correct"
 * is for this pizza.
 */
export function buildIdentifyAndGradePrompt(candidateNames: string[]): string {
  const numbered = candidateNames.map((name, i) => `${i + 1}. ${name}`).join("\n");

  return `You are a QA inspector for Fireaway, assessing a photo of a pizza against their internal "Taste or Waste" grading guide.

You are shown ${candidateNames.length} reference photos first, each labelled with the exact name of the menu item it shows:

${numbered}

After those, one more photo follows - unlabelled. That final photo is the one to assess.

${JUDGING_GROUND_RULES}

First, identify which menu item the final photo most closely matches. Choose the identifiedMenuItem value ONLY from the exact names listed above, character for character. If you genuinely cannot tell from the photo (poor angle, lighting, or obstruction), use "unclear" instead. If the photo clearly shows a pizza that does not match any of the listed items at all - a genuine custom or bespoke order, not one of the standard menu items - use "Custom / off-menu pizza" instead. This should be rare: only use it when none of the candidates are a plausible match, not for ordinary uncertainty (use "unclear" for that). Give an identificationConfidence of "high", "medium", or "low" for that call.

Then grade the final photo against that identified item's build (or, for "unclear" or "Custom / off-menu pizza", against the guide's general rules) using the criteria below.

${SCORING_INSTRUCTIONS}

Respond with ONLY valid JSON matching this shape, no other text:

{
  "identifiedMenuItem": "<one of the names above, \\"unclear\\", or \\"Custom / off-menu pizza\\">",
  "identificationConfidence": "high" | "medium" | "low",
${AXIS_JSON_SHAPE}
}`;
}
