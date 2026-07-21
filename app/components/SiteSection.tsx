import Link from "next/link";
import DayPartCard from "@/app/components/DayPartCard";
import { formatDateLabel } from "@/lib/date";
import type { Capture, DayPart, MenuItem, Role, Site } from "@/types";

export interface DateRow {
  date: string;
  captures: Capture[];
}

export default function SiteSection({
  site,
  dayParts,
  dateRows,
  menuItems,
  linkToFilter,
  linkDate,
  showDateLabels,
  viewerRole,
}: {
  site: Site;
  dayParts: DayPart[];
  dateRows: DateRow[];
  menuItems: MenuItem[];
  linkToFilter: boolean;
  linkDate: string;
  showDateLabels: boolean;
  viewerRole: Role;
}) {
  const brandMenuItems = menuItems.filter((m) => m.brandId === site.brandId);
  const totalCaptures = dateRows.reduce((n, row) => n + row.captures.length, 0);
  // Nothing to show for this site at all - an overview row for a site
  // with no photos yet, or a single/all-dates view with no history.
  // Skip the day-part grid entirely rather than rendering a wall of
  // empty placeholder squares.
  const isEmpty = dateRows.length === 0 || (linkToFilter && totalCaptures === 0);

  return (
    <div className="flex flex-col gap-3">
      {linkToFilter ? (
        <Link
          href={`/dashboard?site=${site.id}&date=${linkDate}&dayPart=`}
          className="text-base font-bold text-navy hover:text-brand"
        >
          {site.name}
        </Link>
      ) : (
        <h2 className="text-base font-bold text-navy">{site.name}</h2>
      )}

      {isEmpty ? (
        <p className="text-[13px] text-muted">No photos uploaded yet</p>
      ) : (
        <div className="flex flex-col gap-5">
          {dateRows.map((row) => (
            <div key={row.date} className="flex flex-col gap-2">
              {showDateLabels && (
                <h3 className="text-[13px] font-bold text-secondary">{formatDateLabel(row.date)}</h3>
              )}
              <div className={`grid gap-4 ${dayParts.length > 1 ? "md:grid-cols-3" : "max-w-sm"}`}>
                {dayParts.map((dayPart) => (
                  <DayPartCard
                    key={dayPart.id}
                    siteId={site.id}
                    date={row.date}
                    dayPart={dayPart}
                    captures={row.captures.filter((c) => c.dayPartId === dayPart.id)}
                    menuItems={brandMenuItems}
                    viewerRole={viewerRole}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
