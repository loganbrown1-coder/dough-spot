# Pizza quality scoring: rubric schema and prompt

Based on Fireaway's "Taste or Waste" guide. Covers the four axes it defines: Spec (recipe accuracy), Neat (presentation), Heat (cooking quality), Stretch (dough shape and structure).

## 1. Scoring schema

Each capture gets scored on all four axes plus an overall verdict. Defects are a controlled vocabulary pulled directly from the guide's "Waste" column, so the output stays consistent across calls and is easy to aggregate later (e.g. "which sites get flagged for no_leopard_spotting most often").

```typescript
export type QualityAxis = "spec" | "neat" | "heat" | "stretch";

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

export type DefectCode<A extends QualityAxis> = (typeof DEFECT_CODES)[A][number];

export interface AxisScore<A extends QualityAxis> {
  score: 1 | 2 | 3 | 4 | 5; // 5 = fully on spec, 1 = clear fail
  defects: DefectCode<A>[]; // empty if none observed
  notes: string; // one or two sentences, specific to this photo
}

export interface QualityAssessment {
  spec: AxisScore<"spec">;
  neat: AxisScore<"neat">;
  heat: AxisScore<"heat">;
  stretch: AxisScore<"stretch">;
  overallScore: 1 | 2 | 3 | 4 | 5; // holistic, not just an average
  verdict: "pass" | "fail" | "borderline";
  confidence: "high" | "medium" | "low"; // low = flag for human review regardless of verdict
  summary: string; // 1-2 sentence plain-English readout
}
```

`confidence: "low"` is the escape hatch for photos where the model genuinely can't tell (bad lighting, obscured angle, box already closed). Treat those as auto-flagged for human review no matter what verdict comes back, same as a borderline score.

## 2. The prompt

Send this as the system/instruction prompt alongside the photo. Where `{{menuItemName}}` and `{{referenceImageUrl}}` are available (Fireaway's menu items already have a `reference_image_url` field in the `menu_items` table), include the reference photo as a second image and mention it explicitly, since "correct topping layout" is only checkable against a spec for that specific pizza.

```
You are a QA inspector for Fireaway, assessing a single photo of a pizza against
their internal "Taste or Waste" grading guide. Judge only what is visible in the
photo. Do not guess at things you can't see (e.g. exact oven temperature, exact
ingredient weights) - use the visual proxies the guide itself defines for those.

The pizza in this photo is: {{menuItemName}}
[If a reference photo is attached: "A reference photo of the correct build for
this item is attached second - use it to judge topping placement and quantity,
not just general pizza appearance."]

Score across four axes. For each, give a 1-5 score, a list of defect codes from
the fixed list below (only include ones you actually observe - leave empty if
none), and a short note.

SPEC - Recipe accuracy
Pass looks like: correct cheese and sauce portion, correct toppings and
quantities, toppings evenly distributed, no centre loading or bare edges.
Defect codes: incorrect_sauce_amount, incorrect_cheese_amount,
incorrect_toppings, incorrect_topping_quantity, uneven_topping_distribution,
centre_overloaded, edges_bare, ingredient_gaps

NEAT - Presentation
Pass looks like: pizza fits the box with a small gap, box is clean, no burnt
flakes or excess flour, cut into even slices, attractive overall.
Defect codes: doesnt_fit_box, box_not_clean, burnt_flakes_visible,
excess_flour_on_crust, uneven_slices, unattractive_presentation, no_dip_visible

HEAT - Cooking quality
Pass looks like: leopard spotting on the crust, light char (not burnt), fully
cooked base, cheese melted evenly, no greasy surface.
Defect codes: no_leopard_spotting, excessive_charring, burnt_crust,
no_char_appearance, doughy_undercooked_base, cheese_unmelted_or_uneven,
greasy_surface

STRETCH - Dough shape and structure
Pass looks like: even round shape, consistent centre thickness, aerated crust
(roughly 1-1.5in), reaches full size for the box, no holes or thin patches.
Defect codes: under_or_over_proofed, misshapen, inconsistent_dough_thickness,
dense_flat_centre, incorrect_size, holes_or_thin_patches

Then give an overallScore (1-5, your holistic judgement, not a mechanical
average), a verdict of "pass", "fail", or "borderline", a confidence of "high",
"medium", or "low" (use "low" whenever lighting, angle, or obstruction genuinely
limits what you can judge), and a one-to-two sentence summary.

Respond with ONLY valid JSON matching this shape, no other text:

{
  "spec": { "score": 1-5, "defects": [...], "notes": "..." },
  "neat": { "score": 1-5, "defects": [...], "notes": "..." },
  "heat": { "score": 1-5, "defects": [...], "notes": "..." },
  "stretch": { "score": 1-5, "defects": [...], "notes": "..." },
  "overallScore": 1-5,
  "verdict": "pass" | "fail" | "borderline",
  "confidence": "high" | "medium" | "low",
  "summary": "..."
}
```

## 3. Example output

```json
{
  "spec": {
    "score": 4,
    "defects": ["uneven_topping_distribution"],
    "notes": "Pepperoni is slightly clustered on one side; sauce and cheese coverage look correct."
  },
  "neat": {
    "score": 5,
    "defects": [],
    "notes": "Fits the box cleanly, even slices, box itself is tidy."
  },
  "heat": {
    "score": 2,
    "defects": ["no_leopard_spotting", "cheese_unmelted_or_uneven"],
    "notes": "Crust looks pale with no charring at all; cheese hasn't fully melted in the centre."
  },
  "stretch": {
    "score": 4,
    "defects": [],
    "notes": "Good round shape and consistent thickness, reaches the edge of the box."
  },
  "overallScore": 3,
  "verdict": "borderline",
  "confidence": "high",
  "summary": "Shape and presentation are solid but this looks underbaked - no leopard spotting and the cheese hasn't fully melted."
}
```

## 4. What's actually built (status: shipped, pending your setup steps)

Sections 1-3 above were the original proposal; this section reflects the real implementation, which went further. All of it is inert until you complete the setup steps at the bottom.

**Storage.** `quality_assessments` (see `supabase/migrations/015_quality_assessments.sql`, `016_quality_assessments_internal_only.sql`, `017_quality_assessment_identification.sql`) - one row per capture per scoring run, written by the service-role client only (there's no insert policy for the RLS-scoped client, since this is a background job, not a user action).

**Visibility.** Fireaway staff (`ops`, `site_manager`) cannot see any of this - enforced at the database level (`016`'s select policy checks the caller's role, not just which sites they can see), not just hidden in the UI. `agent`/`super_admin` only.

**Where it triggers.** `lib/actions/captures.ts`'s `scoreCaptureInBackground`, called from all three photo-writing actions (`uploadCapturesAction`, `addCaptureAction`, `replaceCaptureImageAction`), reusing the image bytes already in memory from the upload itself. Runs via Next's `after()`, not a bare unawaited promise - on Vercel, the function instance can freeze the moment the response is sent, which would silently kill a plain fire-and-forget call before it finishes.

**Human review.** Each photo's quality badge (`app/components/QualityBadge.tsx`, shown on `CaptureTile`) is clickable and lets an agent/admin confirm or correct the verdict - see `lib/actions/quality.ts`'s `reviewQualityAssessmentAction`, which writes `human_verdict`. That's the training signal: not automatic retraining, but the concrete record of where the model agreed or disagreed with a real reviewer, which is what periodic prompt tightening (or eventually few-shot examples, or fine-tuning at real volume) gets built from.

**Menu item identification.** Once a brand's menu items have reference photos (`menu_items.reference_image_url` - still empty for Fireaway as of writing), `assessCapture` automatically switches into "identify and grade" mode: every reference photo gets sent labelled with its item name, followed by the capture photo, and the model says which item it thinks it's looking at (plus a confidence) before grading Spec against that item's actual build rather than generic rules. `lib/data/menuItems.ts`'s `getMenuItemReferences` is what makes this a no-op until reference photos exist - nothing to turn on separately. The identification also shows on the badge ("AI thinks: Pepperoni Feast") with its own Correct/Wrong review buttons, separate from the quality verdict review, since agreeing with the score and agreeing with the identity guess are different judgements. If the guess is wrong, retagging the photo is the existing `updateCaptureMenuItemAction`/menu item dropdown (only available from the Upload page - the dashboard's grid is read-only).

Worth knowing before turning this on: sending every reference photo on every scoring call means cost scales with menu size, not just photo volume - each reference photo adds roughly as many image tokens as the capture photo itself. Fine for a menu of a handful of items; if Fireaway's menu is large, a cheaper two-step approach (a smaller "which one is it" pass, then a full grading call using just the matched reference) is worth revisiting.

## 5. Setup steps

1. Run all four SQL migrations in `supabase/migrations/` (015 through 017, in order) in the Supabase SQL editor.
2. Set `ANTHROPIC_API_KEY` in `.env.local` (and in Vercel's project settings once deployed) - scoring is a silent no-op until this is set.
3. Run `npm install` to pull in `@anthropic-ai/sdk`.
4. Nothing else is required for scores to start appearing on the dashboard (agent/admin accounts only) for every new upload.
5. To get menu item identification working: populate `reference_image_url` on Fireaway's menu items (Admin > Menu items) - it starts working automatically from the next upload after that, no code or config change needed.
