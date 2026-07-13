"use client";

import { useRouter } from "next/navigation";
import type { Organisation } from "@/types";

export default function OrgSwitcher({
  organisations,
  selectedOrgId,
}: {
  organisations: Organisation[];
  selectedOrgId: string | undefined;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedOrgId}
      onChange={(e) => router.push(`/admin?org=${e.target.value}`)}
      className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
    >
      {organisations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
