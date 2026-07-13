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
      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
    >
      {pending ? "Adding..." : "Add site"}
    </button>
  );
}

export default function AddSiteForm({ brands }: { brands: Brand[] }) {
  const [state, formAction] = useActionState(createSiteAction, initialState);

  return (
    <form action={formAction} className="space-y-3" key={state.success ? "reset" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Brand</label>
          <select
            name="brandId"
            required
            defaultValue={brands[0]?.id}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Site name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="Fireaway Manchester"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Site added.</p>}
      <SubmitButton />
    </form>
  );
}
