"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserRoleAction,
  deactivateUserAction,
  reactivateUserAction,
  removeUserAction,
} from "@/lib/actions/admin";
import { ROLE_LABELS } from "@/lib/roleLabels";
import type { Brand, Profile, Role, Site } from "@/types";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "site_manager", label: "Site Manager" },
  { value: "ops", label: "Ops Manager" },
  { value: "agent", label: "OpSpot Agent" },
  { value: "super_admin", label: "OpSpot Admin" },
];

function UserRow({
  user,
  brands,
  sites,
}: {
  user: Profile;
  brands: Brand[];
  sites: Site[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [scopeId, setScopeId] = useState(user.siteId ?? user.brandId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const scopeLabel =
    (user.siteId ? sites.find((s) => s.id === user.siteId)?.name : undefined) ??
    (user.brandId ? brands.find((b) => b.id === user.brandId)?.name : undefined) ??
    "-";

  function saveRole() {
    setError(null);
    startTransition(async () => {
      const result = await updateUserRoleAction(user.id, role, scopeId || null);
      if (result.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function toggleDisabled() {
    const verb = user.disabled ? "Reactivate" : "Deactivate";
    if (!confirm(`${verb} ${user.email}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = user.disabled
        ? await reactivateUserAction(user.id)
        : await deactivateUserAction(user.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Permanently remove ${user.email}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeUserAction(user.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <tr className="border-t border-border-subtle">
        <td className="px-5 py-2.5 text-body">{user.email}</td>
        <td colSpan={3} className="px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as Role);
                setScopeId("");
              }}
              className="h-8 rounded border border-border-default px-2 text-[12px] text-body"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {role === "ops" && (
              <select
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="h-8 rounded border border-border-default px-2 text-[12px] text-body"
              >
                <option value="">Select brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            {role === "site_manager" && (
              <select
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="h-8 rounded border border-border-default px-2 text-[12px] text-body"
              >
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={saveRole}
              disabled={pending}
              className="text-[11px] font-semibold text-brand hover:text-brand-light disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[11px] font-semibold text-secondary hover:text-body"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border-subtle">
      <td className="px-5 py-2.5 text-body">
        {user.email}
        {user.disabled && (
          <span className="ml-2 rounded-brand bg-app px-1.5 py-0.5 text-[10px] font-bold text-muted">
            Deactivated
          </span>
        )}
      </td>
      <td className="px-5 py-2.5 text-secondary">{ROLE_LABELS[user.role]}</td>
      <td className="px-5 py-2.5 text-secondary">{scopeLabel}</td>
      <td className="px-5 py-2.5">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-semibold text-secondary hover:text-brand"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={toggleDisabled}
            disabled={pending}
            className="text-[11px] font-semibold text-secondary hover:text-amber-700 disabled:opacity-50"
          >
            {user.disabled ? "Reactivate" : "Deactivate"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-[11px] font-semibold text-secondary hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
        {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export default function UsersTable({
  title,
  users,
  brands,
  sites,
  emptyMessage,
}: {
  title: string;
  users: Profile[];
  brands: Brand[];
  sites: Site[];
  emptyMessage: string;
}) {
  return (
    <div className="overflow-hidden rounded-brand border border-border-default bg-white">
      <div className="border-b border-border-default bg-app px-5 py-3.5 text-[13px] font-bold text-navy">
        {title}
      </div>
      {users.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-secondary">{emptyMessage}</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left font-bold text-muted">
              <th className="px-5 py-2.5">Email</th>
              <th className="px-5 py-2.5">Role</th>
              <th className="px-5 py-2.5">Scope</th>
              <th className="px-5 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} brands={brands} sites={sites} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
