import CaptureTile from "@/app/components/CaptureTile";
import ClearDayPartButton from "@/app/components/ClearDayPartButton";
import type { Capture, DayPart, MenuItem } from "@/types";

export default function DayPartCard({
  siteId,
  date,
  dayPart,
  captures,
  menuItems,
}: {
  siteId: string;
  date: string;
  dayPart: DayPart;
  captures: Capture[];
  menuItems: MenuItem[];
}) {
  const bySequence = new Map(captures.map((c) => [c.sequence, c]));
  const hasAny = captures.length > 0;

  return (
    <div className="rounded-brand border border-border-default bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-border-default border-l-[3px] border-l-brand px-5 py-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-bold text-navy">{dayPart.label}</h3>
          <span className="text-xs text-muted">
            {dayPart.startTime} - {dayPart.endTime}
          </span>
        </div>
        {hasAny && <ClearDayPartButton siteId={siteId} date={date} dayPartId={dayPart.id} />}
      </div>

      <div className="p-5">
        {!hasAny ? (
          <div className="flex min-h-[96px] items-center justify-center rounded-brand border-[1.5px] border-dashed border-border-default px-3 py-6 text-center">
            <p className="text-[13px] text-muted">No photos uploaded yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((sequence) => {
                const capture = bySequence.get(sequence);
                return (
                  <CaptureTile
                    key={sequence}
                    capture={capture}
                    sequence={sequence}
                    dayPartLabel={dayPart.label}
                    siteId={siteId}
                    date={date}
                    dayPartId={dayPart.id}
                    menuItems={menuItems}
                  />
                );
              })}
            </div>
            <p className="text-xs text-secondary">
              {captures[0].source === "automated" ? "Automated capture" : "Manually uploaded"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
