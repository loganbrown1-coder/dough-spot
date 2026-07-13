"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createOrganisationAction,
  type AdminFormState,
} from "@/lib/actions/admin";

const initialState: AdminFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create organisation"}
    </button>
  );
}

export default function CreateOrganisationForm() {
  const [state, formAction] = useActionState(createOrganisationAction, initialState);

  return (
    <form action={formAction} className="space-y-3" key={state.success ? "reset" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Organisation name
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Acme Pizza Group"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            First admin&apos;s email
          </label>
          <input
            name="adminEmail"
            type="email"
            required
            placeholder="owner@acmepizza.com"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-700">
          Organisation created and an invite email sent.
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
