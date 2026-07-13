"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteUserAction, type AdminFormState } from "@/lib/actions/admin";
import type { Brand, Role, Site } from "@/types";

const initialState: AdminFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
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
  const [role, setRole] = useState<Role>("org_admin");

  return (
    <form action={formAction} className="space-y-3" key={state.success ? "reset" : "form"}>
      <input type="hidden" name="organisationId" value={organisationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Role</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="org_admin">Org admin</option>
            <option value="ops">Ops</option>
            <option value="site_manager">Site manager</option>
            {canInviteSuperAdmin && <option value="super_admin">Super admin</option>}
          </select>
        </div>
      </div>

      {role === "ops" && (
        <div>
          <label className="block text-sm font-medium text-neutral-700">Brand</label>
          <select
            name="brandId"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
        <div>
          <label className="block text-sm font-medium text-neutral-700">Site</label>
          <select
            name="siteId"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Sends an email invite - the person sets their own password when they accept it.
      </p>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Invite sent.</p>}
      <SubmitButton />
    </form>
  );
}
