import DayPartPhotoGrid from "@/app/components/DayPartPhotoGrid";
import type { Capture, DayPart, MenuItem, Role } from "@/types";

export default function DayPartCard({
  siteId,
  date,
  dayPart,
  captures,
  menuItems,
  viewerRole,
}: {
  siteId: string;
  date: string;
  dayPart: DayPart;
  captures: Capture[];
  menuItems: MenuItem[];
  viewerRole: Role;
}) {
  return (
    <div className="rounded-brand border border-border-default bg-white">
      <div className="flex flex-col gap-0.5 border-b border-border-default border-l-[3px] border-l-brand px-5 py-3">
        <h3 className="text-sm font-bold text-navy">{dayPart.label}</h3>
        <span className="text-xs text-muted">
          {dayPart.startTime} - {dayPart.endTime}
        </span>
      </div>

      <div className="p-5">
        <DayPartPhotoGrid
          siteId={siteId}
          date={date}
          dayPartId={dayPart.id}
          dayPartLabel={dayPart.label}
          captures={captures}
          menuItems={menuItems}
          readOnly
          viewerRole={viewerRole}
        />
      </div>
    </div>
  );
}
