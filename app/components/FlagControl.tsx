"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flagCaptureAction, resolveFlagAction } from "@/lib/actions/captures";

export default function FlagControl({
  captureId,
  siteId,
  date,
  dayPartId,
  sequence,
  flagged,
  flagComment,
  canFlag,
  canResolve,
  onChanged,
}: {
  captureId: string;
  siteId: string;
  date: string;
  dayPartId: string;
  sequence: number;
  flagged: boolean;
  flagComment: string | null;
  canFlag: boolean;
  canResolve: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function notify() {
    if (onChanged) onChanged();
    else router.refresh();
  }

  function submitFlag() {
    if (!comment.trim()) {
      setError("Add a note about what's wrong.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await flagCaptureAction(captureId, siteId, date, dayPartId, sequence, comment);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        setComment("");
        notify();
      }
    });
  }

  function resolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveFlagAction(captureId, siteId, date, dayPartId, sequence);
      if (result.error) setError(result.error);
      else notify();
    });
  }

  if (flagged) {
    return (
      <div className="flex flex-col gap-1 rounded-brand border border-amber-300 bg-amber-50 px-2 py-1.5">
        <p className="text-[10px] font-bold text-amber-800">⚑ Flagged</p>
        {flagComment && <p className="text-[10px] leading-snug text-amber-700">{flagComment}</p>}
        {canResolve && (
          <button
            type="button"
            onClick={resolve}
            disabled={pending}
            className="self-start text-[10px] font-semibold text-amber-800 underline hover:text-amber-900 disabled:opacity-50"
          >
            {pending ? "Resolving..." : "Resolve"}
          </button>
        )}
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  if (!canFlag) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[10px] font-semibold text-secondary hover:text-amber-700"
      >
        Flag an issue
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What's wrong? e.g. tagged as Pepperoni but it's Margherita"
        rows={2}
        className="rounded-brand border border-border-default px-2 py-1 text-[11px] text-body"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={submitFlag}
          disabled={pending}
          className="text-[10px] font-semibold text-brand hover:text-brand-light disabled:opacity-50"
        >
          {pending ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-[10px] font-semibold text-secondary hover:text-body"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
