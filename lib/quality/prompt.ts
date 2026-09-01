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

const SCORING_INSTRUCTIONS = `Score across four axes. For each, give a 1-5 score, a list of defect codes from the fixed list below (only include ones you actually observe - leave empty if none), and a short note.

${RUBRIC}

Score generously - a 4 or 5 is the normal, expected result for an ordinary sellable pizza. Reserve 1-2 scores for defects clear and severe enough that a customer would genuinely complain, not small cosmetic imperfections. The same applies to the overall verdict: "fail" means a pizza you would not want served at all - a pizza with one minor, forgivable issue should land on "pass" or "borderline" instead, not "fail".

Then give an overallScore (1-5, your holistic judgement, not a mechanical average), a verdict of "pass", "fail", or "borderline", a confidence of "high", "medium", or "low" (use "low" whenever lighting, angle, or obstruction genuinely limits what you can judge), and a one-to-two sentence summary.`;

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
  return `You are a QA inspector for Fireaway, assessing a single photo of a pizza against their internal "Taste or Waste" grading guide. Judge only what is visible in the photo. Do not guess at things you can't see (e.g. exact oven temperature, exact ingredient weights) - use the visual proxies the guide itself defines for those.

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

After those, one more photo follows - unlabelled. That final photo is the one to assess. Judge only what is visible in it. Do not guess at things you can't see (e.g. exact oven temperature, exact ingredient weights) - use the visual proxies the guide itself defines for those.

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
