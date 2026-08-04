"use client";

import { useActionState, useEffect, useState } from "react";
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
      className="h-9 shrink-0 whitespace-nowrap rounded-brand bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create organisation"}
    </button>
  );
}

export default function CreateOrganisationForm() {
  const [state, formAction] = useActionState(createOrganisationAction, initialState);
  // See AddSiteForm for why this is a counter rather than
  // state.success ? "reset" : "form" - that only remounts once.
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResetKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3.5" key={resetKey}>
      <div className="flex flex-col items-end gap-3 sm:flex-row">
        <div className="flex w-full flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Organisation name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="Acme Pizza Group"
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <SubmitButton />
      </div>
      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && (
        <p className="text-[13px] text-success">
          Organisation created. Add a brand and site, then invite users from
          the Users tab.
        </p>
      )}
    </form>
  );
}
