"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrganisationRetentionAction } from "@/lib/actions/admin";

export default function RetentionField({
  organisationId,
  retentionDays,
}: {
  organisationId: string;
  retentionDays: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(retentionDays));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    const days = Number(value);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOrganisationRetentionAction(organisationId, days);
      if (result.error) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="h-8 w-20 rounded border border-border-default px-2 text-[12px] text-body"
      />
      <span className="text-[12px] text-secondary">days</span>
      <button
        type="button"
        onClick={save}
        disabled={pending || Number(value) === retentionDays}
        className="text-[11px] font-semibold text-brand hover:text-brand-light disabled:opacity-40"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {saved && !pending && <span className="text-[11px] text-success">Saved</span>}
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
