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
    <label className="flex items-center gap-2 text-[13px] font-bold text-body">
      Organisation
      <select
        value={selectedOrgId}
        onChange={(e) => router.push(`/admin?org=${e.target.value}`)}
        className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
      >
        {organisations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </label>
  );
}
