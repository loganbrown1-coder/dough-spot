import Link from "next/link";
import DayPartCard from "@/app/components/DayPartCard";
import type { Capture, DayPart, Site } from "@/types";

export default function SiteSection({
  site,
  dayParts,
  captures,
  date,
  menuItemNameById,
  linkToFilter,
}: {
  site: Site;
  dayParts: DayPart[];
  captures: Capture[];
  date: string;
  menuItemNameById: Map<string, string>;
  linkToFilter: boolean;
}) {
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
            dayPart={dayPart}
            captures={captures.filter((c) => c.dayPartId === dayPart.id)}
            menuItemNameById={menuItemNameById}
          />
        ))}
      </div>
    </div>
  );
}
