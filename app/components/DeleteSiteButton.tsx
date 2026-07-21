"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSiteAction } from "@/lib/actions/admin";

export default function DeleteSiteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Remove ${name}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSiteAction(id);
      if (result.error) setError(result.error);
      else router.refresh();
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
        {pending ? "Removing..." : "Remove"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
