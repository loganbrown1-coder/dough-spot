"use client";

import { useEffect, useState, useTransition } from "react";
import { rateCaptureAction } from "@/lib/actions/captures";
import type { Capture } from "@/types";

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
  menuItemName,
}: {
  capture?: Capture;
  sequence: number;
  dayPartLabel: string;
  menuItemName?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="aspect-square cursor-zoom-in overflow-hidden rounded-brand"
        aria-label={`View ${alt} larger`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={capture.imageUrl}
          alt={alt}
          className="h-full w-full object-cover transition hover:opacity-90"
        />
      </button>
      <p className="truncate text-[11px] font-semibold text-body">
        {menuItemName ?? <span className="text-muted">No menu item</span>}
      </p>
      <StarRating captureId={capture.id} rating={capture.rating} />
      {lightboxOpen && (
        <Lightbox
          imageUrl={capture.imageUrl}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
