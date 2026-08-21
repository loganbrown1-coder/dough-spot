"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { updateMenuItemPhotoAction } from "@/lib/actions/admin";
import { compressImage } from "@/lib/compressImage";

export default function MenuItemPhotoField({
  menuItemId,
  imageUrl,
  name,
}: {
  menuItemId: string;
  imageUrl: string | null;
  name: string;
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
      // Same compression captures already go through - this photo is sent
      // to Claude on every scoring call once reference photos are in use
      // (see getMenuItemReferences), so an uncompressed original would
      // multiply cost by however much larger it is than a capture photo,
      // for no accuracy benefit.
      const compressed = await compressImage(file);
      const result = await updateMenuItemPhotoAction(menuItemId, compressed);
      if (result.error) setError(result.error);
      else router.refresh();
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-10 w-10 rounded-brand object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-brand bg-app" />
        )}
        <label className="cursor-pointer text-[11px] font-semibold text-secondary hover:text-brand">
          {pending ? "Working..." : "Change"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            disabled={pending}
            className="hidden"
          />
        </label>
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
