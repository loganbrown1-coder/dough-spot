"use client";

import { useState } from "react";
import CaptureTile from "@/app/components/CaptureTile";
import ClearDayPartButton from "@/app/components/ClearDayPartButton";
import Lightbox from "@/app/components/Lightbox";
import type { Capture, MenuItem } from "@/types";

export default function DayPartPhotoGrid({
  siteId,
  date,
  dayPartId,
  dayPartLabel,
  captures,
  menuItems,
  readOnly,
  onChanged,
}: {
  siteId: string;
  date: string;
  dayPartId: string;
  dayPartLabel: string;
  captures: Capture[];
  menuItems: MenuItem[];
  readOnly: boolean;
  onChanged?: () => void;
}) {
  const bySequence = new Map(captures.map((c) => [c.sequence, c]));
  const hasAny = captures.length > 0;
  const ordered = [1, 2, 3]
    .map((seq) => bySequence.get(seq))
    .filter((c): c is Capture => Boolean(c));

  const [openSequence, setOpenSequence] = useState<number | null>(null);
  const openIndex = ordered.findIndex((c) => c.sequence === openSequence);

  function step(delta: number) {
    if (openIndex === -1 || ordered.length === 0) return;
    const next = (openIndex + delta + ordered.length) % ordered.length;
    setOpenSequence(ordered[next].sequence);
  }

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && hasAny && (
        <div className="flex justify-end">
          <ClearDayPartButton siteId={siteId} date={date} dayPartId={dayPartId} onChanged={onChanged} />
        </div>
      )}

      {!hasAny ? (
        <div className="flex min-h-[96px] items-center justify-center rounded-brand border-[1.5px] border-dashed border-border-default px-3 py-6 text-center">
          <p className="text-[13px] text-muted">No photos uploaded yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((sequence) => (
              <CaptureTile
                key={sequence}
                capture={bySequence.get(sequence)}
                sequence={sequence}
                dayPartLabel={dayPartLabel}
                siteId={siteId}
                date={date}
                dayPartId={dayPartId}
                menuItems={menuItems}
                readOnly={readOnly}
                onOpen={setOpenSequence}
                onChanged={onChanged}
              />
            ))}
          </div>
          <p className="text-xs text-secondary">
            {captures[0].source === "automated" ? "Automated capture" : "Manually uploaded"}
          </p>
        </div>
      )}

      {openIndex !== -1 && (
        <Lightbox
          imageUrl={ordered[openIndex].imageUrl}
          alt={`${dayPartLabel} photo ${ordered[openIndex].sequence}`}
          onClose={() => setOpenSequence(null)}
          onPrev={ordered.length > 1 ? () => step(-1) : undefined}
          onNext={ordered.length > 1 ? () => step(1) : undefined}
        />
      )}
    </div>
  );
}
