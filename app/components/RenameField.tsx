"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RenameField({
  id,
  name,
  action,
}: {
  id: string;
  name: string;
  action: (id: string, name: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{name}</span>
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          className="text-[11px] font-semibold text-secondary hover:text-brand"
        >
          Rename
        </button>
      </div>
    );
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await action(id, trimmed);
      if (result.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          className="h-7 rounded border border-border-default px-2 text-[13px] text-body"
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
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
