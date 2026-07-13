"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createSiteAction, type AdminFormState } from "@/lib/actions/admin";
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
      {pending ? "Adding..." : "Add site"}
    </button>
  );
}

export default function AddSiteForm({ brands }: { brands: Brand[] }) {
  const [state, formAction] = useActionState(createSiteAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5" key={state.success ? "reset" : "form"}>
      <div className="flex items-end gap-3">
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
          <label className="text-xs font-bold text-body">Site name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Riverside"
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <SubmitButton />
      </div>
      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && <p className="text-[13px] text-success">Site added.</p>}
    </form>
  );
}
