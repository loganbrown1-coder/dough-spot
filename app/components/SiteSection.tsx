import Link from "next/link";
import DayPartCard from "@/app/components/DayPartCard";
import type { RankingsSibling } from "@/app/components/QualityRankingsModal";
import { formatDateLabel } from "@/lib/date";
import type { QualityAssessmentRecord } from "@/lib/quality/schema";
import type { Capture, DayPart, MenuItem, Role, Site } from "@/types";

export interface DateRow {
  date: string;
  captures: Capture[];
}

/**
 * Every capture for this site on this date, across all of its day parts,
 * in day-part-then-sequence order - what the Rankings modal pages through
 * on the dashboard, so "2 of 9" means the whole day rather than just one
 * day part's 3 photos.
 */
function daySiblingsForRow(row: DateRow, dayParts: DayPart[]): RankingsSibling[] {
  const labelByDayPartId = new Map(dayParts.map((dp) => [dp.id, dp.label]));
  const orderIndex = new Map(dayParts.map((dp, i) => [dp.id, i]));
  return [...row.captures]
    .filter((c) => orderIndex.has(c.dayPartId))
    .sort((a, b) => {
      const dayPartDelta = orderIndex.get(a.dayPartId)! - orderIndex.get(b.dayPartId)!;
      return dayPartDelta !== 0 ? dayPartDelta : a.sequence - b.sequence;
    })
    .map((capture) => ({ capture, dayPartLabel: labelByDayPartId.get(capture.dayPartId)! }));
}

export default function SiteSection({
  site,
  dayParts,
  dateRows,
  menuItems,
  qualityByCaptureId,
  linkToFilter,
  linkDate,
  showDateLabels,
  viewerRole,
}: {
  site: Site;
  dayParts: DayPart[];
  dateRows: DateRow[];
  menuItems: MenuItem[];
  qualityByCaptureId: Record<string, QualityAssessmentRecord>;
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
          {dateRows.map((row) => {
            const daySiblings = daySiblingsForRow(row, dayParts);
            return (
              <div key={row.date} className="flex flex-col gap-2">
                {showDateLabels && (
                  <h3 className="text-[13px] font-bold text-secondary">{formatDateLabel(row.date)}</h3>
                )}
                <div className={`grid gap-4 ${dayParts.length > 1 ? "md:grid-cols-3" : "max-w-sm"}`}>
                  {dayParts.map((dayPart) => (
                    <DayPartCard
                      key={dayPart.id}
                      siteId={site.id}
                      siteName={site.name}
                      date={row.date}
                      dayPart={dayPart}
                      captures={row.captures.filter((c) => c.dayPartId === dayPart.id)}
                      menuItems={brandMenuItems}
                      qualityByCaptureId={qualityByCaptureId}
                      daySiblings={daySiblings}
                      viewerRole={viewerRole}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
