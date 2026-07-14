import Link from "next/link";
import DayPartCard from "@/app/components/DayPartCard";
import type { Capture, DayPart, MenuItem, Site } from "@/types";

export default function SiteSection({
  site,
  dayParts,
  captures,
  date,
  menuItems,
  linkToFilter,
}: {
  site: Site;
  dayParts: DayPart[];
  captures: Capture[];
  date: string;
  menuItems: MenuItem[];
  linkToFilter: boolean;
}) {
  const brandMenuItems = menuItems.filter((m) => m.brandId === site.brandId);

  return (
    <div className="flex flex-col gap-3">
      {linkToFilter ? (
        <Link
          href={`/dashboard?site=${site.id}&date=${date}&dayPart=`}
          className="text-base font-bold text-navy hover:text-brand"
        >
          {site.name}
        </Link>
      ) : (
        <h2 className="text-base font-bold text-navy">{site.name}</h2>
      )}
      <div className={`grid gap-4 ${dayParts.length > 1 ? "md:grid-cols-3" : "max-w-sm"}`}>
        {dayParts.map((dayPart) => (
          <DayPartCard
            key={dayPart.id}
            siteId={site.id}
            date={date}
            dayPart={dayPart}
            captures={captures.filter((c) => c.dayPartId === dayPart.id)}
            menuItems={brandMenuItems}
          />
        ))}
      </div>
    </div>
  );
}
