"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { forgotPasswordAction, type ForgotPasswordState } from "@/lib/actions/auth";

const initialState: ForgotPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[42px] w-full rounded-brand bg-brand font-bold text-white transition hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Sending..." : "Send reset link"}
    </button>
  );
}

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-brand border border-border-default bg-[#FAFBFC] px-3 py-2.5 text-[13px] text-body">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
        <Link
          href="/login"
          className="text-center text-[13px] font-bold text-brand hover:text-brand-light"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-bold text-body">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
        />
      </div>
      {state.error && (
        <p className="rounded-brand border border-error-border bg-error-bg px-3 py-2.5 text-[13px] text-error">
          {state.error}
        </p>
      )}
      <SubmitButton />
      <Link
        href="/login"
        className="text-center text-[13px] font-bold text-brand hover:text-brand-light"
      >
        Back to sign in
      </Link>
    </form>
  );
}
