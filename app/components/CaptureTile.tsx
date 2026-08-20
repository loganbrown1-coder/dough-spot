"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  updateCaptureMenuItemAction,
  replaceCaptureImageAction,
  addCaptureAction,
  deleteCaptureAction,
} from "@/lib/actions/captures";
import { compressImage, compressThumbnail } from "@/lib/compressImage";
import QualityBadge from "@/app/components/QualityBadge";
import QualityRankingsModal, { type RankingsSibling } from "@/app/components/QualityRankingsModal";
import FlagControl from "@/app/components/FlagControl";
import type { QualityAssessmentRecord } from "@/lib/quality/schema";
import type { Capture, MenuItem, Role } from "@/types";

function MenuItemSelect({
  captureId,
  menuItemId,
  menuItems,
}: {
  captureId: string;
  menuItemId: string | null;
  menuItems: MenuItem[];
}) {
  const [value, setValue] = useState(menuItemId ?? "");
  const [, startTransition] = useTransition();

  function handleChange(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateCaptureMenuItemAction(captureId, next || null);
      if (result.error) setValue(previous);
    });
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full truncate rounded border border-transparent bg-transparent text-[11px] font-semibold text-body hover:border-border-default focus:border-brand focus:outline-none"
    >
      <option value="">No menu item</option>
      {menuItems.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}

export default function CaptureTile({
  capture,
  sequence,
  dayPartLabel,
  siteId,
  siteName,
  date,
  dayPartId,
  menuItems,
  quality,
  qualityByCaptureId,
  rankingsSiblings,
  readOnly,
  viewerRole,
  onOpen,
  onChanged,
}: {
  capture?: Capture;
  sequence: number;
  dayPartLabel: string;
  siteId: string;
  siteName: string;
  date: string;
  dayPartId: string;
  menuItems: MenuItem[];
  quality?: QualityAssessmentRecord;
  /** Every capture the Rankings modal can page through - see QualityRankingsModal's own doc comment. */
  qualityByCaptureId: Record<string, QualityAssessmentRecord>;
  rankingsSiblings: RankingsSibling[];
  readOnly: boolean;
  viewerRole: Role;
  onOpen: (sequence: number) => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRankings, setShowRankings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addCommentRef = useRef<HTMLTextAreaElement>(null);

  const canManage = viewerRole === "agent" || viewerRole === "super_admin";

  async function handleAdd(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const thumbnail = await compressThumbnail(file);
      const comment = addCommentRef.current?.value.trim() || null;
      const result = await addCaptureAction(
        siteId,
        date,
        dayPartId,
        sequence,
        compressed,
        thumbnail,
        comment
      );
      if (result.error) setError(result.error);
      else {
        if (addCommentRef.current) addCommentRef.current.value = "";
        notifyChanged();
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!capture) {
    // A day part can be partially uploaded (e.g. only 1 of 3 photos exist
    // yet), and this empty slot is how the missing ones get added one at
    // a time - previously the only way to add a photo here was through
    // uploadCapturesAction's "provide all three" form, which forced
    // resubmitting photos that already existed just to satisfy it.
    if (readOnly || !canManage) {
      return (
        <div
          className="aspect-square overflow-hidden rounded-brand"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #EDEFF2 0 8px, #E3E7EB 8px 16px)",
          }}
        />
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <label className="relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-brand border-[1.5px] border-dashed border-border-default bg-[#FAFBFC] text-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-brand bg-brand-bg text-brand">
            ↑
          </span>
          <span className="text-[11px] font-semibold text-secondary">
            {busy ? "Working..." : "Add photo"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAdd}
            disabled={busy}
            className="sr-only"
          />
        </label>
        <textarea
          ref={addCommentRef}
          rows={2}
          placeholder="Comment (optional)"
          disabled={busy}
          className="resize-none rounded-brand border border-border-default px-2 py-1 text-[10px] text-body"
        />
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  const canFlag = viewerRole === "ops" || viewerRole === "site_manager" || viewerRole === "super_admin";
  const alt = `${dayPartLabel} photo ${sequence}`;
  const menuItemName = menuItems.find((m) => m.id === capture.menuItemId)?.name;
  // quality.identifiedMenuItemId only ever holds an id (see the comment on
  // rowToRecord in lib/data/qualityAssessments.ts) - resolved to a name
  // here rather than re-fetched, since CaptureTile already has the full
  // menu item list in scope for the (currently tagged) menuItemName above.
  const identifiedMenuItemName = quality?.identifiedMenuItemId
    ? menuItems.find((m) => m.id === quality.identifiedMenuItemId)?.name ?? null
    : quality?.identifiedMenuItemName ?? null; // "unclear" case - not an id, but still worth showing

  function notifyChanged() {
    if (onChanged) onChanged();
    else router.refresh();
  }

  async function handleReplace(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !capture) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const thumbnail = await compressThumbnail(file);
      const result = await replaceCaptureImageAction(
        capture.id,
        siteId,
        date,
        dayPartId,
        sequence,
        compressed,
        thumbnail
      );
      if (result.error) setError(result.error);
      else notifyChanged();
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDelete() {
    if (!capture) return;
    if (!confirm("Delete this photo? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    (async () => {
      const result = await deleteCaptureAction(capture.id, siteId, date, dayPartId, sequence);
      setBusy(false);
      if (result.error) setError(result.error);
      else notifyChanged();
    })();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen(sequence)}
          className="aspect-square w-full cursor-zoom-in overflow-hidden rounded-brand"
          aria-label={`View ${alt} larger`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capture.thumbnailUrl ?? capture.imageUrl}
            alt={alt}
            className="h-full w-full object-cover transition hover:opacity-90"
            onError={(e) => {
              // Covers a capture uploaded before thumbnails existed, or any
              // other reason the small variant 404s - fall back to the
              // full-size image rather than showing a broken tile.
              if (e.currentTarget.src !== capture.imageUrl) {
                e.currentTarget.src = capture.imageUrl;
              }
            }}
          />
        </button>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-brand bg-white/70">
            <span className="text-[11px] font-semibold text-muted">Working...</span>
          </div>
        )}
      </div>

      {!readOnly && canManage && (
        <div className="flex items-center justify-between gap-1">
          <label className="cursor-pointer text-[10px] font-semibold text-secondary hover:text-brand">
            Replace
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReplace}
              disabled={busy}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-[10px] font-semibold text-secondary hover:text-red-600 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}

      {!readOnly && canManage ? (
        <MenuItemSelect captureId={capture.id} menuItemId={capture.menuItemId} menuItems={menuItems} />
      ) : (
        <p className="truncate text-[11px] font-semibold text-body">
          {menuItemName ?? <span className="text-muted">No menu item</span>}
        </p>
      )}

      {capture.comment && (
        <p className="rounded-brand border border-border-default bg-app px-2 py-1 text-[10px] leading-snug text-secondary">
          {capture.comment}
        </p>
      )}

      {/* Internal only (OpSpot's own accounts) - Fireaway staff (ops,
          site_manager) don't see automated quality scores yet. This is a
          UI-level check on top of the real gate: quality_assessments'
          select policy already excludes those roles at the database level
          (see supabase/migrations/016_quality_assessments_internal_only.sql),
          so `quality` will simply be undefined for them regardless - this
          just avoids relying on that alone. */}
      {canManage && (
        <>
          {quality && (
            <QualityBadge
              assessment={quality}
              identifiedMenuItemName={identifiedMenuItemName}
              currentMenuItemName={menuItemName ?? null}
              onChanged={notifyChanged}
            />
          )}
          {/* Always shown, not just once a score exists - the modal itself
              says "not scored yet" rather than the button appearing and
              disappearing per photo depending on backend state, which read
              as broken rather than "just not scored". */}
          <button
            type="button"
            onClick={() => setShowRankings(true)}
            className="self-start text-[10px] font-semibold text-secondary hover:text-brand"
          >
            Rankings
          </button>
          {showRankings && (
            <QualityRankingsModal
              siblings={rankingsSiblings}
              qualityByCaptureId={qualityByCaptureId}
              initialCaptureId={capture.id}
              siteName={siteName}
              menuItems={menuItems}
              viewerRole={viewerRole}
              readOnly={readOnly}
              onClose={() => setShowRankings(false)}
            />
          )}
        </>
      )}

      <FlagControl
        captureId={capture.id}
        siteId={siteId}
        date={date}
        dayPartId={dayPartId}
        sequence={sequence}
        flagged={capture.flagged}
        flagComment={capture.flagComment}
        canFlag={readOnly && canFlag}
        canResolve={canManage}
        onChanged={notifyChanged}
      />

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
