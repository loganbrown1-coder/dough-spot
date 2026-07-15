"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { rateCaptureAction, replaceCaptureImageAction, deleteCaptureAction } from "@/lib/actions/captures";
import { compressImage } from "@/lib/compressImage";
import type { Capture, MenuItem } from "@/types";

function StarRating({
  captureId,
  rating,
  readOnly,
}: {
  captureId: string;
  rating: number | null;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState(rating);
  const [, startTransition] = useTransition();

  if (readOnly) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`text-sm leading-none ${
              rating !== null && n <= rating ? "text-brand" : "text-border-default"
            }`}
          >
            ★
          </span>
        ))}
      </div>
    );
  }

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

export default function CaptureTile({
  capture,
  sequence,
  dayPartLabel,
  siteId,
  date,
  dayPartId,
  menuItems,
  readOnly,
  onOpen,
  onChanged,
}: {
  capture?: Capture;
  sequence: number;
  dayPartLabel: string;
  siteId: string;
  date: string;
  dayPartId: string;
  menuItems: MenuItem[];
  readOnly: boolean;
  onOpen: (sequence: number) => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!capture) {
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

  const alt = `${dayPartLabel} photo ${sequence}`;
  const menuItemName = menuItems.find((m) => m.id === capture.menuItemId)?.name;

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
      const result = await replaceCaptureImageAction(
        capture.id,
        siteId,
        date,
        dayPartId,
        sequence,
        compressed
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
      const result = await deleteCaptureAction(capture.id, capture.imageUrl);
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
            src={capture.imageUrl}
            alt={alt}
            className="h-full w-full object-cover transition hover:opacity-90"
          />
        </button>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-brand bg-white/70">
            <span className="text-[11px] font-semibold text-muted">Working...</span>
          </div>
        )}
      </div>

      {!readOnly && (
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

      <p className="truncate text-[11px] font-semibold text-body">
        {menuItemName ?? <span className="text-muted">No menu item</span>}
      </p>
      <StarRating captureId={capture.id} rating={capture.rating} readOnly={readOnly} />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
