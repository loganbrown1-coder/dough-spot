"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteUserAction, type AdminFormState } from "@/lib/actions/admin";
import type { Brand, Role, Site } from "@/types";

const initialState: AdminFormState = {};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "site_manager", label: "Site Manager" },
  { value: "ops", label: "Area / Ops Manager" },
  { value: "org_admin", label: "Company Admin" },
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

export default function InviteUserForm({
  organisationId,
  brands,
  sites,
  canInviteSuperAdmin,
}: {
  organisationId: string;
  brands: Brand[];
  sites: Site[];
  canInviteSuperAdmin: boolean;
}) {
  const [state, formAction] = useActionState(inviteUserAction, initialState);
  const [role, setRole] = useState<Role>("site_manager");

  return (
    <form action={formAction} className="flex flex-col gap-3.5" key={state.success ? "reset" : "form"}>
      <input type="hidden" name="organisationId" value={organisationId} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="name@restaurant.com"
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
            {canInviteSuperAdmin && <option value="super_admin">Super Admin</option>}
          </select>
        </div>
      </div>

      {role === "ops" && (
        <div className="flex max-w-[320px] flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Brand</label>
          <select
            name="brandId"
            required
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {role === "site_manager" && (
        <div className="flex max-w-[320px] flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Site</label>
          <select
            name="siteId"
            required
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Sends an email invite — no password is set here.</p>
        <SubmitButton />
      </div>

      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && <p className="text-[13px] text-success">Invite sent.</p>}
    </form>
  );
}
