import type { Capture, DayPart } from "@/types";

const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #EDEFF2 0 8px, #E3E7EB 8px 16px)",
};

export default function DayPartCard({
  dayPart,
  captures,
}: {
  dayPart: DayPart;
  captures: Capture[];
}) {
  const bySequence = new Map(captures.map((c) => [c.sequence, c]));
  const hasAny = captures.length > 0;

  return (
    <div className="rounded-brand border border-border-default bg-white">
      <div className="flex flex-col gap-0.5 border-b border-border-default border-l-[3px] border-l-brand px-5 py-3">
        <h3 className="text-sm font-bold text-navy">{dayPart.label}</h3>
        <span className="text-xs text-muted">
          {dayPart.startTime} - {dayPart.endTime}
        </span>
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
                  <div
                    key={sequence}
                    className="aspect-square overflow-hidden rounded-brand"
                    style={capture ? undefined : HATCH}
                  >
                    {capture && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={capture.imageUrl}
                        alt={`${dayPart.label} photo ${sequence}`}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
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
