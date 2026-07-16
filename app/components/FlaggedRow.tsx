"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import {
  rateCaptureAction,
  updateCaptureMenuItemAction,
  replaceCaptureImageAction,
  deleteCaptureAction,
  resolveFlagAction,
} from "@/lib/actions/captures";
import { compressImage } from "@/lib/compressImage";
import Lightbox from "@/app/components/Lightbox";
import type { Capture, MenuItem } from "@/types";

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function MiniStars({ captureId, rating }: { captureId: string; rating: number | null }) {
  const [value, setValue] = useState(rating);
  const [, startTransition] = useTransition();

  function handleClick(n: number) {
    const next = value === n ? null : n;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await rateCaptureAction(captureId, next);
      if (result.error) setValue(previous);
    });
  }

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => handleClick(n)}
          aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
          className={`text-sm leading-none ${
            value !== null && n <= value ? "text-brand" : "text-border-default"
          } hover:text-brand-light`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function MiniMenuItemSelect({
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
      className="h-7 rounded border border-border-default bg-white px-1.5 text-[12px] text-body"
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

export default function FlaggedRow({
  capture,
  siteName,
  orgName,
  dayPartLabel,
  menuItems,
  onResolved,
}: {
  capture: Capture;
  siteName: string;
  orgName?: string;
  dayPartLabel: string;
  menuItems: MenuItem[];
  onResolved: (captureId: string) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const alt = `${dayPartLabel} photo ${capture.sequence}`;

  async function handleReplace(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const result = await replaceCaptureImageAction(
        capture.id,
        capture.siteId,
        capture.date,
        capture.dayPartId,
        capture.sequence,
        compressed
      );
      if (result.error) setError(result.error);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDelete() {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    (async () => {
      const result = await deleteCaptureAction(
        capture.id,
        capture.siteId,
        capture.date,
        capture.dayPartId,
        capture.sequence
      );
      setBusy(false);
      if (result.error) setError(result.error);
      else onResolved(capture.id);
    })();
  }

  function handleResolve() {
    setBusy(true);
    setError(null);
    (async () => {
      const result = await resolveFlagAction(
        capture.id,
        capture.siteId,
        capture.date,
        capture.dayPartId,
        capture.sequence
      );
      setBusy(false);
      if (result.error) setError(result.error);
      else onResolved(capture.id);
    })();
  }

  return (
    <div className="flex flex-col gap-3 rounded-brand border border-amber-300 bg-amber-50/40 p-4 sm:flex-row sm:items-start">
      <div className="relative h-28 w-28 shrink-0">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="h-full w-full cursor-zoom-in overflow-hidden rounded-brand"
          aria-label={`View ${alt} larger`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capture.imageUrl} alt={alt} className="h-full w-full object-cover" />
        </button>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-brand bg-white/70">
            <span className="text-[10px] font-semibold text-muted">Working...</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div>
          <p className="text-sm font-bold text-navy">
            {orgName ? `${orgName} → ` : ""}
            {siteName}
          </p>
          <p className="text-xs text-muted">
            {capture.date} · {dayPartLabel} · Photo {capture.sequence}
          </p>
        </div>

        <div className="rounded-brand border border-amber-300 bg-amber-100/60 px-3 py-2">
          <p className="text-[11px] font-bold text-amber-800">
            Flagged by {capture.flaggedByEmail ?? "unknown"}
            {capture.flaggedAt && ` · ${formatRelative(capture.flaggedAt)}`}
          </p>
          {capture.flagComment && (
            <p className="mt-0.5 text-[13px] text-amber-900">{capture.flagComment}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <MiniMenuItemSelect
            captureId={capture.id}
            menuItemId={capture.menuItemId}
            menuItems={menuItems}
          />
          <MiniStars captureId={capture.id} rating={capture.rating} />
          <label className="cursor-pointer text-[12px] font-semibold text-secondary hover:text-brand">
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
            className="text-[12px] font-semibold text-secondary hover:text-red-600 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={busy}
            className="ml-auto text-[12px] font-bold text-brand hover:text-brand-light disabled:opacity-50"
          >
            {busy ? "Working..." : "Resolve"}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>

      {lightboxOpen && (
        <Lightbox imageUrl={capture.imageUrl} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
