"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createDayPartAction, type DayPartFormState } from "@/lib/actions/admin";

const initialState: DayPartFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 shrink-0 whitespace-nowrap rounded-brand bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Adding..." : "Add day part"}
    </button>
  );
}

export default function AddDayPartForm({ organisationId }: { organisationId: string }) {
  const [state, formAction] = useActionState(createDayPartAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5" key={state.success ? "reset" : "form"}>
      <input type="hidden" name="organisationId" value={organisationId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Label</label>
          <input
            name="label"
            type="text"
            required
            placeholder="e.g. Breakfast"
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Start</label>
          <input
            name="startTime"
            type="time"
            required
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-body">End</label>
          <input
            name="endTime"
            type="time"
            required
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <SubmitButton />
      </div>
      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && <p className="text-[13px] text-success">Day part added.</p>}
    </form>
  );
}
