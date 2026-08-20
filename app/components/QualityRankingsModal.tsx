"use client";

import { useEffect } from "react";
import type { QualityAssessmentRecord, QualityAxis } from "@/lib/quality/schema";

const AXES: { key: QualityAxis; label: string; description: string }[] = [
  { key: "spec", label: "Spec", description: "Recipe accuracy" },
  { key: "neat", label: "Neat", description: "Presentation" },
  { key: "heat", label: "Heat", description: "Cooking quality" },
  { key: "stretch", label: "Stretch", description: "Dough shape & structure" },
];

function scoreStyle(score: number): string {
  if (score >= 4) return "border-green-300 bg-green-50 text-green-800";
  if (score === 3) return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-red-300 bg-red-50 text-red-800";
}

/** "no_leopard_spotting" -> "No leopard spotting" */
function humanizeDefect(code: string): string {
  const spaced = code.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function QualityRankingsModal({
  imageUrl,
  alt,
  assessment,
  onClose,
}: {
  imageUrl: string;
  alt: string;
  /** null when this photo hasn't been scored yet - shown as a "not scored" state rather than hiding the button that opens this modal. */
  assessment: QualityAssessmentRecord | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 text-2xl font-bold text-white/80 hover:text-white"
      >
        ×
      </button>

      <div
        className="flex max-h-full w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-brand bg-white p-5 sm:flex-row sm:gap-6 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-center sm:w-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="max-h-64 w-full rounded-brand object-cover sm:max-h-none"
          />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          {assessment ? (
            <>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-brand border px-2 py-0.5 text-xs font-bold ${scoreStyle(assessment.overallScore)}`}
                  >
                    Overall {assessment.overallScore}/5 · {assessment.verdict}
                  </span>
                  {assessment.confidence === "low" && (
                    <span className="text-[11px] font-semibold text-amber-700">Low confidence</span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-secondary">{assessment.summary}</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {AXES.map((axis) => {
                  const data = assessment[axis.key];
                  return (
                    <div
                      key={axis.key}
                      className="flex flex-col gap-1.5 rounded-brand border border-border-default p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-bold text-navy">{axis.label}</p>
                          <p className="text-[10px] text-muted">{axis.description}</p>
                        </div>
                        <span
                          className={`rounded-brand border px-1.5 py-0.5 text-[11px] font-bold ${scoreStyle(data.score)}`}
                        >
                          {data.score}/5
                        </span>
                      </div>
                      {data.defects.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {data.defects.map((defect) => (
                            <span
                              key={defect}
                              className="rounded-brand bg-app px-1.5 py-0.5 text-[10px] font-semibold text-secondary"
                            >
                              {humanizeDefect(defect)}
                            </span>
                          ))}
                        </div>
                      )}
                      {data.notes && <p className="text-[11px] leading-snug text-secondary">{data.notes}</p>}
                    </div>
                  );
                })}
              </div>

              {assessment.humanReviewed && (
                <p className="text-[11px] text-muted">
                  Human-reviewed:{" "}
                  <span className="font-semibold text-body">{assessment.humanVerdict}</span>
                  {assessment.humanVerdict !== assessment.verdict && " (corrected from the model's verdict)"}
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <span className="rounded-brand border border-border-default bg-app px-2 py-0.5 text-xs font-bold text-secondary">
                  Not scored yet
                </span>
                <p className="mt-1.5 text-[13px] leading-snug text-secondary">
                  This photo hasn&apos;t been scored. Scoring runs automatically in the background
                  shortly after a photo is uploaded.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {AXES.map((axis) => (
                  <div
                    key={axis.key}
                    className="flex items-center justify-between rounded-brand border border-border-default p-2.5"
                  >
                    <div>
                      <p className="text-[13px] font-bold text-navy">{axis.label}</p>
                      <p className="text-[10px] text-muted">{axis.description}</p>
                    </div>
                    <span className="rounded-brand border border-border-default bg-app px-1.5 py-0.5 text-[11px] font-bold text-muted">
                      —/5
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
