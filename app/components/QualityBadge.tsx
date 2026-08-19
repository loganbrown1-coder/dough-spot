"use client";

import { useState, useTransition } from "react";
import { reviewQualityAssessmentAction, reviewIdentificationAction } from "@/lib/actions/quality";
import type { QualityAssessmentRecord, QualityVerdict } from "@/lib/quality/schema";

const VERDICT_STYLES: Record<QualityVerdict, string> = {
  pass: "border-green-300 bg-green-50 text-green-800",
  borderline: "border-amber-300 bg-amber-50 text-amber-800",
  fail: "border-red-300 bg-red-50 text-red-800",
};

const VERDICT_ICON: Record<QualityVerdict, string> = {
  pass: "✓",
  borderline: "~",
  fail: "✗",
};

const VERDICT_OPTIONS: QualityVerdict[] = ["pass", "borderline", "fail"];

/**
 * Shows Claude's automated quality score for a capture (see lib/quality and
 * docs/pizza-quality-scoring.md) and lets an agent/admin confirm or correct
 * its verdict, and separately its menu item identification (once reference
 * photos exist - see identifiedMenuItemName) - this is the human-in-the-loop
 * step. Every confirm/correct writes back via reviewQualityAssessmentAction
 * / reviewIdentificationAction, which is the label data for judging how
 * well the model's calls track a real reviewer's over time, and eventually
 * what any prompt tightening (or fine-tuning, at a much larger volume than
 * four sites) gets built from.
 *
 * Only ever rendered for OpSpot's own accounts - CaptureTile gates this the
 * same way it gates everything else internal, and quality_assessments is
 * invisible to Fireaway staff at the database level regardless (see
 * supabase/migrations/016_quality_assessments_internal_only.sql).
 */
export default function QualityBadge({
  assessment,
  identifiedMenuItemName,
  currentMenuItemName,
  onChanged,
}: {
  assessment: QualityAssessmentRecord;
  /** Resolved to a live name by the caller (CaptureTile) - see the comment there for why this isn't just read off the assessment directly. */
  identifiedMenuItemName: string | null;
  /** What the photo is actually tagged as right now, for comparison against the AI's guess. */
  currentMenuItemName: string | null;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(assessment.humanReviewed);
  const [humanVerdict, setHumanVerdict] = useState(assessment.humanVerdict);
  const [idReviewed, setIdReviewed] = useState(assessment.identificationReviewed);
  const [idCorrect, setIdCorrect] = useState(assessment.identificationCorrect);

  function submitVerdict(verdict: QualityVerdict) {
    setError(null);
    startTransition(async () => {
      const result = await reviewQualityAssessmentAction(assessment.id, verdict);
      if (result.error) {
        setError(result.error);
        return;
      }
      setReviewed(true);
      setHumanVerdict(verdict);
      onChanged?.();
    });
  }

  function submitIdentification(correct: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await reviewIdentificationAction(assessment.id, correct);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIdReviewed(true);
      setIdCorrect(correct);
      onChanged?.();
    });
  }

  const showIdentification = Boolean(identifiedMenuItemName);
  const identificationMismatch =
    showIdentification && currentMenuItemName !== null && identifiedMenuItemName !== currentMenuItemName;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded-brand border px-2 py-1 text-[10px] font-semibold ${VERDICT_STYLES[assessment.verdict]}`}
        title={assessment.summary}
      >
        <span>
          {VERDICT_ICON[assessment.verdict]} {assessment.overallScore}/5
        </span>
        <span className="text-[9px] font-normal opacity-75">
          {reviewed ? (humanVerdict === assessment.verdict ? "confirmed" : "corrected") : "review"}
        </span>
      </button>

      {showIdentification && (
        <p className={`text-[10px] leading-snug ${identificationMismatch ? "font-semibold text-amber-700" : "text-secondary"}`}>
          AI thinks: {identifiedMenuItemName}
          {identificationMismatch && ` (tagged as ${currentMenuItemName ?? "nothing"})`}
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-1.5 rounded-brand border border-border-default bg-white p-1.5">
          <p className="text-[10px] leading-snug text-secondary">{assessment.summary}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">
            Is this verdict right?
          </p>
          <div className="flex gap-1">
            {VERDICT_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => submitVerdict(v)}
                disabled={pending}
                title={v === assessment.verdict ? "The model's own verdict" : undefined}
                className={`flex-1 rounded-brand border px-1.5 py-1 text-[10px] font-semibold capitalize disabled:opacity-50 ${
                  v === assessment.verdict
                    ? VERDICT_STYLES[v]
                    : "border-border-default text-secondary hover:border-brand"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {showIdentification && (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">
                Is &quot;{identifiedMenuItemName}&quot; right?
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => submitIdentification(true)}
                  disabled={pending}
                  className={`flex-1 rounded-brand border px-1.5 py-1 text-[10px] font-semibold disabled:opacity-50 ${
                    idReviewed && idCorrect === true
                      ? "border-green-300 bg-green-50 text-green-800"
                      : "border-border-default text-secondary hover:border-brand"
                  }`}
                >
                  Correct
                </button>
                <button
                  type="button"
                  onClick={() => submitIdentification(false)}
                  disabled={pending}
                  className={`flex-1 rounded-brand border px-1.5 py-1 text-[10px] font-semibold disabled:opacity-50 ${
                    idReviewed && idCorrect === false
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-border-default text-secondary hover:border-brand"
                  }`}
                >
                  Wrong
                </button>
              </div>
              {idReviewed && idCorrect === false && (
                <p className="text-[9px] leading-snug text-muted">
                  Retag it correctly from the Upload page - the dashboard&apos;s photo grid is read-only.
                </p>
              )}
            </>
          )}

          {error && <p className="text-[10px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
