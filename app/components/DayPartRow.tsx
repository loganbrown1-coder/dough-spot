"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDayPartAction, deleteDayPartAction } from "@/lib/actions/admin";
import type { DayPart } from "@/types";

export default function DayPartRow({ dayPart }: { dayPart: DayPart }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(dayPart.label);
  const [startTime, setStartTime] = useState(dayPart.startTime);
  const [endTime, setEndTime] = useState(dayPart.endTime);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateDayPartAction(dayPart.id, label, startTime, endTime);
      if (result.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!confirm(`Remove ${dayPart.label}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDayPartAction(dayPart.id, dayPart.organisationId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <tr className="border-t border-border-subtle align-top">
        <td className="px-5 py-2.5" colSpan={2}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 w-36 rounded border border-border-default px-2 text-[13px] text-body"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-8 rounded border border-border-default px-2 text-[13px] text-body"
            />
            <span className="text-[13px] text-muted">to</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-8 rounded border border-border-default px-2 text-[13px] text-body"
            />
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="text-[11px] font-semibold text-brand hover:text-brand-light disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[11px] font-semibold text-secondary hover:text-body"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border-subtle align-top">
      <td className="px-5 py-2.5 text-body">{dayPart.label}</td>
      <td className="px-5 py-2.5 text-secondary">
        <div className="flex items-center gap-3">
          <span>
            {dayPart.startTime} - {dayPart.endTime}
          </span>
          <button
            type="button"
            onClick={() => {
              setLabel(dayPart.label);
              setStartTime(dayPart.startTime);
              setEndTime(dayPart.endTime);
              setEditing(true);
            }}
            className="text-[11px] font-semibold text-secondary hover:text-brand"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-[11px] font-semibold text-secondary hover:text-red-600 disabled:opacity-50"
          >
            {pending ? "Removing..." : "Remove"}
          </button>
        </div>
        {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
