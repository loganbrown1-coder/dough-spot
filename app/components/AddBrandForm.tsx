"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createBrandAction, type AdminFormState } from "@/lib/actions/admin";

const initialState: AdminFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 shrink-0 whitespace-nowrap rounded-brand bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Adding..." : "Add brand"}
    </button>
  );
}

export default function AddBrandForm({ organisationId }: { organisationId: string }) {
  const [state, formAction] = useActionState(createBrandAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5" key={state.success ? "reset" : "form"}>
      <input type="hidden" name="organisationId" value={organisationId} />
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Brand name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Fireaway"
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <SubmitButton />
      </div>
      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && <p className="text-[13px] text-success">Brand added.</p>}
    </form>
  );
}
