"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDayPartCapturesAction } from "@/lib/actions/captures";

export default function ClearDayPartButton({
  siteId,
  date,
  dayPartId,
  onChanged,
}: {
  siteId: string;
  date: string;
  dayPartId: string;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("Clear all photos for this day part? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDayPartCapturesAction(siteId, date, dayPartId);
      if (result.error) setError(result.error);
      else if (onChanged) onChanged();
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-[11px] font-semibold text-muted hover:text-red-600 disabled:opacity-50"
      >
        {pending ? "Clearing..." : "Clear all"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
