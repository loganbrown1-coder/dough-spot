"use client";

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  rateCaptureAction,
  updateCaptureMenuItemAction,
  replaceCaptureImageAction,
  deleteCaptureAction,
} from "@/lib/actions/captures";
import { compressImage } from "@/lib/compressImage";
import type { Capture, MenuItem } from "@/types";

function StarRating({ captureId, rating }: { captureId: string; rating: number | null }) {
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
      onClick={(e) => e.stopPropagation()}
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

function Lightbox({
  imageUrl,
  alt,
  onClose,
}: {
  imageUrl: string;
  alt: string;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        className="max-h-full max-w-full rounded-brand object-contain"
        onClick={(e) => e.stopPropagation()}
      />
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
}: {
  capture?: Capture;
  sequence: number;
  dayPartLabel: string;
  siteId: string;
  date: string;
  dayPartId: string;
  menuItems: MenuItem[];
}) {
  const router = useRouter();
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
      else router.refresh();
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
      else router.refresh();
    })();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
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

      <MenuItemSelect captureId={capture.id} menuItemId={capture.menuItemId} menuItems={menuItems} />
      <StarRating captureId={capture.id} rating={capture.rating} />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      {lightboxOpen && (
        <Lightbox imageUrl={capture.imageUrl} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
