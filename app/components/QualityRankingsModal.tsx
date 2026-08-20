"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FlagControl from "@/app/components/FlagControl";
import { formatTime } from "@/lib/date";
import type { QualityAssessmentRecord, QualityAxis } from "@/lib/quality/schema";
import type { Capture, MenuItem, Role } from "@/types";

const AXES: { key: QualityAxis; label: string; description: string }[] = [
  { key: "spec", label: "Spec", description: "Recipe accuracy" },
  { key: "neat", label: "Neat", description: "Presentation" },
  { key: "heat", label: "Heat", description: "Cooking quality" },
  { key: "stretch", label: "Stretch", description: "Dough shape & structure" },
];

const RING_COLOR = { good: "#16A34A", mid: "#D97706", bad: "#DC2626" } as const;

function tierFor(score: number): keyof typeof RING_COLOR {
  if (score >= 4) return "good";
  if (score === 3) return "mid";
  return "bad";
}

/** "no_leopard_spotting" -> "No leopard spotting" */
function humanizeDefect(code: string): string {
  const spaced = code.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface RankingsSibling {
  capture: Capture;
  dayPartLabel: string;
}

export default function QualityRankingsModal({
  siblings,
  qualityByCaptureId,
  initialCaptureId,
  siteName,
  menuItems,
  viewerRole,
  onClose,
}: {
  /** Every capture navigable from this modal, in display order - crosses
      day parts on the dashboard (a whole site+date's photos) but is scoped
      to just the current shift's 3 on the upload page, which doesn't have
      the rest of the day loaded. */
  siblings: RankingsSibling[];
  qualityByCaptureId: Record<string, QualityAssessmentRecord>;
  initialCaptureId: string;
  siteName: string;
  menuItems: MenuItem[];
  viewerRole: Role;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(0, siblings.findIndex((s) => s.capture.id === initialCaptureId))
  );

  const canFlag = viewerRole === "ops" || viewerRole === "site_manager" || viewerRole === "super_admin";

  function step(delta: number) {
    if (siblings.length === 0) return;
    setIndex((i) => (i + delta + siblings.length) % siblings.length);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, siblings.length]);

  const current = siblings[index];
  if (!current) return null;
  const { capture, dayPartLabel } = current;
  const assessment = qualityByCaptureId[capture.id] ?? null;
  const menuItemName = menuItems.find((m) => m.id === capture.menuItemId)?.name ?? "Unmatched photo";
  const scoredCaption = assessment
    ? (() => {
        const gapSeconds = Math.max(
          0,
          Math.round(
            (new Date(assessment.createdAt).getTime() - new Date(capture.capturedAt).getTime()) / 1000
          )
        );
        return `Scored automatically ${formatTime(assessment.createdAt)}, ${gapSeconds}s after upload`;
      })()
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 sm:flex-row" onClick={onClose}>
      {/* Photo panel */}
      <div
        className="relative flex h-[42vh] shrink-0 items-center justify-center bg-black sm:h-full sm:flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={capture.imageUrl}
          alt={`${dayPartLabel} photo`}
          className="max-h-full max-w-full object-contain"
        />

        <span className="absolute left-3 top-3 rounded-brand bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
          {formatTime(capture.capturedAt)}
        </span>

        {siblings.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white/90 hover:bg-white/20 sm:left-6"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white/90 hover:bg-white/20 sm:right-6"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-brand bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">
              {index + 1} of {siblings.length} · {dayPartLabel}
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      <div
        className="flex w-full flex-col gap-4 overflow-y-auto bg-white p-5 sm:h-full sm:w-[380px] sm:shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-navy">{menuItemName}</h2>
            <p className="mt-0.5 text-[12px] text-secondary">
              {siteName} · {dayPartLabel} · {capture.source === "automated" ? "Automated capture" : "Manually uploaded"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-2xl font-bold text-secondary hover:text-navy"
          >
            ×
          </button>
        </div>

        {assessment ? (
          <>
            <div className="flex items-center gap-4">
              <div
                className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(${RING_COLOR[tierFor(assessment.overallScore)]} ${
                    (assessment.overallScore / 5) * 100
                  }%, #E5E7EB 0)`,
                }}
              >
                <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-lg font-extrabold text-navy">{assessment.overallScore}</span>
                  <span className="text-[9px] font-semibold text-muted">out of 5</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold capitalize text-navy">{assessment.verdict}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-secondary">{assessment.summary}</p>
                {assessment.confidence === "low" && (
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-700">Low confidence</p>
                )}
              </div>
            </div>
            {scoredCaption && <p className="text-[10.5px] text-muted">{scoredCaption}</p>}

            <div className="flex flex-col gap-3">
              {AXES.map((axis) => {
                const data = assessment[axis.key];
                const color = RING_COLOR[tierFor(data.score)];
                return (
                  <div key={axis.key} className="flex items-center gap-3">
                    <div className="w-16 shrink-0">
                      <p className="text-[12px] font-bold text-navy">{axis.label}</p>
                      <p className="text-[9.5px] leading-tight text-muted">{axis.description}</p>
                    </div>
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4, 5].map((segment) => (
                        <span
                          key={segment}
                          className="h-2 flex-1 rounded-full"
                          style={{ backgroundColor: segment <= data.score ? color : "#E5E7EB" }}
                        />
                      ))}
                    </div>
                    <span className="w-6 shrink-0 text-right text-[12px] font-bold text-navy">
                      {data.score}
                    </span>
                  </div>
                );
              })}
            </div>

            {(assessment.spec.notes || assessment.neat.notes || assessment.heat.notes || assessment.stretch.notes) && (
              <div className="rounded-brand border border-border-default bg-app p-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Why this score</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {AXES.filter((axis) => assessment[axis.key].notes).map((axis) => (
                    <li key={axis.key} className="text-[11.5px] leading-snug text-secondary">
                      <span className="font-semibold text-body">{axis.label}:</span> {assessment[axis.key].notes}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {[...assessment.spec.defects, ...assessment.neat.defects, ...assessment.heat.defects, ...assessment.stretch.defects]
              .length > 0 && (
              <div className="flex flex-wrap gap-1">
                {[...assessment.spec.defects, ...assessment.neat.defects, ...assessment.heat.defects, ...assessment.stretch.defects].map(
                  (defect, i) => (
                    <span
                      key={`${defect}-${i}`}
                      className="rounded-brand bg-app px-1.5 py-0.5 text-[10px] font-semibold text-secondary"
                    >
                      {humanizeDefect(defect)}
                    </span>
                  )
                )}
              </div>
            )}

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
            <div className="flex flex-col gap-3">
              {AXES.map((axis) => (
                <div key={axis.key} className="flex items-center gap-3">
                  <div className="w-16 shrink-0">
                    <p className="text-[12px] font-bold text-navy">{axis.label}</p>
                    <p className="text-[9.5px] leading-tight text-muted">{axis.description}</p>
                  </div>
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((segment) => (
                      <span key={segment} className="h-2 flex-1 rounded-full bg-app" />
                    ))}
                  </div>
                  <span className="w-6 shrink-0 text-right text-[12px] font-bold text-muted">—</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-auto flex flex-col gap-2 border-t border-border-subtle pt-4">
          {canFlag && (
            <FlagControl
              captureId={capture.id}
              siteId={capture.siteId}
              date={capture.date}
              dayPartId={capture.dayPartId}
              sequence={capture.sequence}
              flagged={capture.flagged}
              flagComment={capture.flagComment}
              canFlag={canFlag}
              canResolve={viewerRole === "super_admin"}
            />
          )}
          <div className="flex gap-2">
            {/* Rescoring an already-assessed photo isn't built yet - it would
                need to re-download the image from Storage and re-run
                assessCapture. Shown (not hidden) so its absence reads as
                "not built" rather than the button silently disappearing. */}
            <button
              type="button"
              disabled
              title="Rescoring isn't available yet"
              className="flex-1 cursor-not-allowed rounded-brand border border-border-default px-3 py-2 text-[12px] font-bold text-muted opacity-60"
            >
              Rescore
            </button>
            <Link
              href={`/dashboard?site=${capture.siteId}`}
              onClick={onClose}
              className="flex-1 rounded-brand border border-border-default px-3 py-2 text-center text-[12px] font-bold text-body hover:bg-app"
            >
              Full rankings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
