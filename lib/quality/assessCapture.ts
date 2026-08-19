import Anthropic from "@anthropic-ai/sdk";
import { buildQualityPrompt, buildIdentifyAndGradePrompt } from "./prompt";
import {
  DEFECT_CODES,
  type AxisScore,
  type QualityAssessment,
  type QualityAxis,
  type QualityConfidence,
} from "./schema";

/**
 * Pinned rather than "latest" - so a model upgrade is a deliberate,
 * reviewable change (and shows up distinctly in quality_assessments.model
 * for anyone comparing scoring history across versions later), not
 * something that silently shifts every score the next time Anthropic ships
 * a new default.
 */
const MODEL = "claude-sonnet-5";

const VALID_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY. Get a key from console.anthropic.com and add it to .env.local (see .env.local.example)."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function resolveMediaType(mimeType: string): MediaType {
  return (VALID_MEDIA_TYPES.has(mimeType) ? mimeType : "image/jpeg") as MediaType;
}

function imageBlock(imageBuffer: Buffer, mimeType: string) {
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: resolveMediaType(mimeType),
      data: imageBuffer.toString("base64"),
    },
  };
}

export interface ReferenceItem {
  menuItemId: string;
  name: string;
  imageBuffer: Buffer;
  mimeType: string;
}

export interface AssessCaptureParams {
  /** Raw image bytes - callers already have this in memory from the upload itself, so no storage round-trip is needed. */
  imageBuffer: Buffer;
  /** The uploaded file's content type, e.g. "image/jpeg". Falls back to image/jpeg if not one Claude accepts. */
  mimeType: string;
  /** The tagged menu item's name, if any - only used when referenceItems is empty (see below). */
  menuItemName: string | null;
  /**
   * The brand's menu items that have a reference photo set (see
   * lib/data/menuItems.ts#getMenuItemReferences). When non-empty, this
   * switches assessCapture into "identify and grade" mode: every reference
   * photo is sent labelled with its item name, followed by the capture
   * photo, and the model is asked to say which item it matches before
   * grading Spec against that specific build - see
   * buildIdentifyAndGradePrompt. When empty (the default today, since no
   * brand has reference photos populated yet), falls back to grading
   * against the guide's general rules using menuItemName above.
   */
  referenceItems?: ReferenceItem[];
}

/**
 * Scores a single capture against the Taste or Waste rubric using Claude's
 * vision capability, optionally identifying which menu item it is first
 * (see referenceItems above). Throws on any failure (missing key, API
 * error, unparseable/invalid response) - callers are expected to treat this
 * as best-effort background work, same as logCaptureEvent, and swallow the
 * error rather than let it block the upload it's describing.
 */
export async function assessCapture(params: AssessCaptureParams): Promise<QualityAssessment> {
  const anthropic = getClient();
  const referenceItems = params.referenceItems ?? [];

  const content =
    referenceItems.length > 0
      ? [
          ...referenceItems.flatMap((item) => [
            { type: "text" as const, text: `Reference photo: ${item.name}` },
            imageBlock(item.imageBuffer, item.mimeType),
          ]),
          { type: "text" as const, text: "Photo to assess:" },
          imageBlock(params.imageBuffer, params.mimeType),
          {
            type: "text" as const,
            text: buildIdentifyAndGradePrompt(referenceItems.map((i) => i.name)),
          },
        ]
      : [
          imageBlock(params.imageBuffer, params.mimeType),
          { type: "text" as const, text: buildQualityPrompt(params.menuItemName) },
        ];

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model returned no text content.");
  }

  return parseAssessment(textBlock.text, referenceItems);
}

export const QUALITY_MODEL = MODEL;

/**
 * The model is instructed to return only JSON, but strips code fences
 * defensively in case it wraps the response in ```json ... ``` anyway -
 * this happens occasionally even with an explicit "no other text"
 * instruction.
 */
function parseAssessment(raw: string, referenceItems: ReferenceItem[]): QualityAssessment {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse model response as JSON: ${raw.slice(0, 200)}`);
  }
  return validateAssessment(parsed, referenceItems);
}

/**
 * Defensive validation of the model's JSON, not just a type cast - an LLM
 * response is untrusted input like any other API response. Unknown defect
 * codes are silently dropped rather than rejecting the whole assessment,
 * since a stray/renamed code shouldn't take down an otherwise-usable score.
 */
function validateAxis(axis: QualityAxis, value: unknown): AxisScore {
  const v = value as { score?: unknown; defects?: unknown; notes?: unknown } | null;
  const rawScore = Number(v?.score);
  if (!v || !Number.isFinite(rawScore) || rawScore < 1 || rawScore > 5) {
    throw new Error(`Invalid or missing score for axis "${axis}".`);
  }

  const allowed = new Set<string>(DEFECT_CODES[axis]);
  const defects = Array.isArray(v.defects)
    ? v.defects.filter((d): d is string => typeof d === "string" && allowed.has(d))
    : [];

  return {
    score: Math.round(rawScore) as 1 | 2 | 3 | 4 | 5,
    defects: defects as AxisScore["defects"],
    notes: typeof v.notes === "string" ? v.notes : "",
  };
}

function isQualityConfidence(value: unknown): value is QualityConfidence {
  return value === "high" || value === "medium" || value === "low";
}

/**
 * Resolves the model's chosen identifiedMenuItem name back to a menu item
 * id - the model only ever sees names (an LLM fabricating a plausible-
 * looking UUID would be far more likely to go wrong than matching a short
 * exact string it was just shown), so this is where that name gets turned
 * back into something the rest of the app can use. Anything other than an
 * exact match against a name actually offered - including the model's own
 * "unclear" - resolves to no id.
 */
function resolveIdentifiedMenuItem(
  identifiedMenuItem: unknown,
  referenceItems: ReferenceItem[]
): { id: string | null; name: string | null } {
  if (typeof identifiedMenuItem !== "string") return { id: null, name: null };
  const match = referenceItems.find((item) => item.name === identifiedMenuItem);
  return match ? { id: match.menuItemId, name: match.name } : { id: null, name: identifiedMenuItem };
}

function validateAssessment(value: unknown, referenceItems: ReferenceItem[]): QualityAssessment {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object") throw new Error("Model response was not a JSON object.");

  const verdict = v.verdict;
  if (verdict !== "pass" && verdict !== "fail" && verdict !== "borderline") {
    throw new Error(`Invalid verdict: ${String(verdict)}`);
  }
  const confidence = v.confidence;
  if (!isQualityConfidence(confidence)) {
    throw new Error(`Invalid confidence: ${String(confidence)}`);
  }

  const overallRaw = Number(v.overallScore);
  const overallScore = (
    Number.isFinite(overallRaw) ? Math.round(Math.min(5, Math.max(1, overallRaw))) : 3
  ) as 1 | 2 | 3 | 4 | 5;

  const identified =
    referenceItems.length > 0
      ? resolveIdentifiedMenuItem(v.identifiedMenuItem, referenceItems)
      : { id: null, name: null };
  const identificationConfidence =
    referenceItems.length > 0 && isQualityConfidence(v.identificationConfidence)
      ? v.identificationConfidence
      : null;

  return {
    spec: validateAxis("spec", v.spec),
    neat: validateAxis("neat", v.neat),
    heat: validateAxis("heat", v.heat),
    stretch: validateAxis("stretch", v.stretch),
    overallScore,
    verdict,
    confidence,
    summary: typeof v.summary === "string" ? v.summary : "",
    identifiedMenuItemId: identified.id,
    identifiedMenuItemName: identified.name,
    identificationConfidence,
  };
}
