"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createMenuItemAction, type AdminFormState } from "@/lib/actions/admin";
import type { Brand } from "@/types";

const initialState: AdminFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 shrink-0 whitespace-nowrap rounded-brand bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Adding..." : "Add menu item"}
    </button>
  );
}

export default function AddMenuItemForm({ brands }: { brands: Brand[] }) {
  const [state, formAction] = useActionState(createMenuItemAction, initialState);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-3.5" key={state.success ? "reset" : "form"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Brand</label>
          <select
            name="brandId"
            required
            defaultValue={brands[0]?.id}
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Margherita"
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label
            htmlFor="referenceImage"
            className="text-xs font-bold text-body"
          >
            Reference photo
          </label>
          <label
            htmlFor="referenceImage"
            className="flex h-9 cursor-pointer items-center rounded-brand border border-border-default px-2.5 text-[13px] text-secondary"
          >
            <span className="truncate">{fileName ?? "Choose file"}</span>
          </label>
          <input
            id="referenceImage"
            name="referenceImage"
            type="file"
            accept="image/*"
            required
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </div>
        <SubmitButton />
      </div>
      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && <p className="text-[13px] text-success">Menu item added.</p>}
    </form>
  );
}
