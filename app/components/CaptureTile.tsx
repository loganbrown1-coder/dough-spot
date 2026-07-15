"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  rateCaptureAction,
  updateCaptureMenuItemAction,
  replaceCaptureImageAction,
  deleteCaptureAction,
  flagCaptureAction,
  resolveFlagAction,
} from "@/lib/actions/captures";
import { compressImage } from "@/lib/compressImage";
import type { Capture, MenuItem, Role } from "@/types";

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

function FlagControl({
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

export default function CaptureTile({
  capture,
  sequence,
  dayPartLabel,
  siteId,
  date,
  dayPartId,
  menuItems,
  readOnly,
  viewerRole,
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
  viewerRole: Role;
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

  const canManage = viewerRole === "agent" || viewerRole === "super_admin";
  const canFlag = viewerRole === "ops" || viewerRole === "site_manager";
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
      const result = await deleteCaptureAction(
        capture.id,
        capture.imageUrl,
        siteId,
        date,
        dayPartId,
        sequence
      );
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

      {!readOnly && canManage && (
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

      {!readOnly && canManage ? (
        <MenuItemSelect captureId={capture.id} menuItemId={capture.menuItemId} menuItems={menuItems} />
      ) : (
        <p className="truncate text-[11px] font-semibold text-body">
          {menuItemName ?? <span className="text-muted">No menu item</span>}
        </p>
      )}

      <StarRating captureId={capture.id} rating={capture.rating} readOnly={readOnly || !canManage} />

      <FlagControl
        captureId={capture.id}
        siteId={siteId}
        date={date}
        dayPartId={dayPartId}
        sequence={sequence}
        flagged={capture.flagged}
        flagComment={capture.flagComment}
        canFlag={readOnly && canFlag}
        canResolve={canManage}
        onChanged={notifyChanged}
      />

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
