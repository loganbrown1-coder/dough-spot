"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSiteAction, forceDeleteSiteAction } from "@/lib/actions/admin";

function describeCounts(captureCount: number, eventCount: number): string {
  const parts: string[] = [];
  if (captureCount > 0) parts.push(`${captureCount} photo${captureCount === 1 ? "" : "s"}`);
  if (eventCount > 0) {
    parts.push(`${eventCount} activity log entr${eventCount === 1 ? "y" : "ies"}`);
  }
  return parts.join(" and ");
}

export default function DeleteSiteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Set once the safe delete is specifically blocked by photos/history
  // (not by an assigned user) - offers the force-delete escalation below.
  const [offerForce, setOfferForce] = useState<{ captures: number; events: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState("");

  function remove() {
    if (!confirm(`Remove ${name}? This can't be undone.`)) return;
    setError(null);
    setOfferForce(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await deleteSiteAction(id);
      if (result.error) {
        setError(result.error);
        if (result.blockedByCaptures) {
          setOfferForce({ captures: result.captureCount ?? 0, events: result.eventCount ?? 0 });
        }
      } else {
        router.refresh();
      }
    });
  }

  function forceRemove() {
    if (typedName !== name) return;
    setError(null);
    startTransition(async () => {
      const result = await forceDeleteSiteAction(id);
      if (result.error) {
        setError(result.error);
      } else {
        setOfferForce(null);
        setConfirming(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-[11px] font-semibold text-secondary hover:text-red-600 disabled:opacity-50"
      >
        {pending ? "Working..." : "Remove"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}

      {offerForce && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-left text-[10px] font-bold text-red-700 underline hover:text-red-900"
        >
          Delete permanently (including {describeCounts(offerForce.captures, offerForce.events)})
        </button>
      )}

      {confirming && offerForce && (
        <div className="flex w-56 flex-col gap-1.5 rounded border border-red-300 bg-red-50 p-2.5">
          <p className="text-[10px] leading-snug text-red-800">
            Deletes <strong>{name}</strong> and {describeCounts(offerForce.captures, offerForce.events)}{" "}
            permanently. Type the site name to confirm:
          </p>
          <input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={name}
            autoFocus
            className="h-7 rounded border border-red-300 bg-white px-2 text-[11px] text-body"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={forceRemove}
              disabled={pending || typedName !== name}
              className="text-[10px] font-bold text-red-700 hover:text-red-900 disabled:opacity-40"
            >
              {pending ? "Deleting..." : "Confirm permanent delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setTypedName("");
              }}
              className="text-[10px] font-semibold text-secondary hover:text-body"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
