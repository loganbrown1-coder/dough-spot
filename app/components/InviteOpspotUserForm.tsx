"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteUserAction, type AdminFormState } from "@/lib/actions/admin";
import type { Role } from "@/types";

const initialState: AdminFormState = {};

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "agent", label: "OpSpot Agent", hint: "Uploads and rates photos for any customer" },
  { value: "super_admin", label: "OpSpot Admin", hint: "Full admin access across every organisation" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 shrink-0 whitespace-nowrap rounded-brand bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Sending invite..." : "Send invite"}
    </button>
  );
}

export default function InviteOpspotUserForm() {
  const [state, formAction] = useActionState(inviteUserAction, initialState);
  const [role, setRole] = useState<Role>("agent");

  return (
    <form action={formAction} className="flex flex-col gap-3.5" key={state.success ? "reset" : "form"}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="name@opspot.com"
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Role</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted">
            {ROLE_OPTIONS.find((opt) => opt.value === role)?.hint}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Sends an email invite — no password is set here.</p>
        <SubmitButton />
      </div>

      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && <p className="text-[13px] text-success">Invite sent.</p>}
    </form>
  );
}
