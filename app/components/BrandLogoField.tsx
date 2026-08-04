"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { updateBrandLogoAction, removeBrandLogoAction } from "@/lib/actions/admin";

export default function BrandLogoField({
  brandId,
  logoUrl,
}: {
  brandId: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await updateBrandLogoAction(brandId, file);
      if (result.error) setError(result.error);
      else router.refresh();
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeBrandLogoAction(brandId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-8 w-8 rounded border border-border-default object-contain"
          />
        ) : (
          <div className="h-8 w-8 rounded border border-dashed border-border-default" />
        )}
        <label className="cursor-pointer text-[11px] font-semibold text-secondary hover:text-brand">
          {pending ? "Working..." : logoUrl ? "Change" : "Upload"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            disabled={pending}
            className="hidden"
          />
        </label>
        {logoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="text-[11px] font-semibold text-secondary hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
