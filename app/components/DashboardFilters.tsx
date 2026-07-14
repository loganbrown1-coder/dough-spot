"use client";

import { useRouter } from "next/navigation";
import { groupSitesByBrand } from "@/lib/siteGroups";
import type { Brand, DayPart, Site } from "@/types";

export default function DashboardFilters({
  sites,
  brands,
  dayParts,
  selectedSiteId,
  selectedDate,
  selectedDayPartId,
}: {
  sites: Site[];
  brands: Brand[];
  dayParts: DayPart[];
  selectedSiteId: string;
  selectedDate: string;
  selectedDayPartId: string;
}) {
  const router = useRouter();
  const groups = groupSitesByBrand(sites, brands);

  function updateParams(next: { site?: string; date?: string; dayPart?: string }) {
    const params = new URLSearchParams();
    params.set("site", next.site ?? selectedSiteId);
    params.set("date", next.date ?? selectedDate);
    params.set("dayPart", next.dayPart ?? selectedDayPartId);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-5">
      <div className="flex max-w-[340px] flex-1 flex-col gap-1.5">
        <label className="text-[13px] font-bold text-body">Site</label>
        {sites.length > 1 ? (
          <select
            value={selectedSiteId}
            onChange={(e) => updateParams({ site: e.target.value })}
            className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
          >
            <option value="">All sites</option>
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
          <p className="flex h-10 items-center text-sm font-semibold text-body">
            {sites[0]?.name ?? "No site assigned"}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="date" className="text-[13px] font-bold text-body">
          Date
        </label>
        <input
          id="date"
          type="date"
          value={selectedDate}
          onChange={(e) => updateParams({ date: e.target.value })}
          className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-bold text-body">Day part</label>
        <select
          value={selectedDayPartId}
          onChange={(e) => updateParams({ dayPart: e.target.value })}
          className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
        >
          <option value="">All day parts</option>
          {dayParts.map((dp) => (
            <option key={dp.id} value={dp.id}>
              {dp.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
