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
      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
    >
      {pending ? "Adding..." : "Add brand"}
    </button>
  );
}

export default function AddBrandForm({ organisationId }: { organisationId: string }) {
  const [state, formAction] = useActionState(createBrandAction, initialState);

  return (
    <form action={formAction} className="space-y-3" key={state.success ? "reset" : "form"}>
      <input type="hidden" name="organisationId" value={organisationId} />
      <div>
        <label className="block text-sm font-medium text-neutral-700">Brand name</label>
        <input
          name="name"
          type="text"
          required
          placeholder="Fireaway"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Brand added.</p>}
      <SubmitButton />
    </form>
  );
}
