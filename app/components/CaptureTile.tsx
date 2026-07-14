"use client";

import { useState, useTransition } from "react";
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

  return (
    <div className="flex flex-col gap-1">
      <div className="aspect-square overflow-hidden rounded-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={capture.imageUrl}
          alt={`${dayPartLabel} photo ${sequence}`}
          className="h-full w-full object-cover"
        />
      </div>
      <p className="truncate text-[11px] font-semibold text-body">
        {menuItemName ?? <span className="text-muted">No menu item</span>}
      </p>
      <StarRating captureId={capture.id} rating={capture.rating} />
    </div>
  );
}
