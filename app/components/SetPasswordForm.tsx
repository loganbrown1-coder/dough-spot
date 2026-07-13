"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setPasswordAction, type SetPasswordState } from "@/lib/actions/auth";

const initialState: SetPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[42px] w-full rounded-brand bg-brand font-bold text-white transition hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Saving..." : "Set password"}
    </button>
  );
}

export default function SetPasswordForm() {
  const [state, formAction] = useActionState(setPasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-bold text-body">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-[13px] font-bold text-body">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
        />
      </div>
      {state.error && (
        <p className="rounded-brand border border-error-border bg-error-bg px-3 py-2.5 text-[13px] text-error">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
