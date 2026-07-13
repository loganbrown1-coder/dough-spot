"use client";

import { useRouter } from "next/navigation";
import { groupSitesByBrand } from "@/lib/siteGroups";
import type { Brand, Site } from "@/types";

export default function DashboardFilters({
  sites,
  brands,
  selectedSiteId,
  selectedDate,
}: {
  sites: Site[];
  brands: Brand[];
  selectedSiteId: string | undefined;
  selectedDate: string;
}) {
  const router = useRouter();
  const groups = groupSitesByBrand(sites, brands);

  function updateParams(next: { site?: string; date?: string }) {
    const params = new URLSearchParams();
    params.set("site", next.site ?? selectedSiteId ?? "");
    params.set("date", next.date ?? selectedDate);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label className="block text-xs font-medium text-neutral-500">Site</label>
        {sites.length > 1 ? (
          <select
            value={selectedSiteId}
            onChange={(e) => updateParams({ site: e.target.value })}
            className="mt-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {groups.map((group) => (
              <optgroup key={group.brandName} label={group.brandName}>
                {group.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <p className="mt-1 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-neutral-800">
            {sites[0]?.name ?? "No site assigned"}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="date" className="block text-xs font-medium text-neutral-500">
          Date
        </label>
        <input
          id="date"
          type="date"
          value={selectedDate}
          onChange={(e) => updateParams({ date: e.target.value })}
          className="mt-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
    </div>
  );
}
