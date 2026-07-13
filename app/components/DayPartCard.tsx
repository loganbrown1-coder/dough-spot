import type { Capture, DayPart } from "@/types";

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
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">
          {dayPart.label} ({dayPart.id})
        </h3>
        <span className="text-xs text-neutral-500">
          {dayPart.startTime} - {dayPart.endTime}
        </span>
      </div>

      {!hasAny ? (
        <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-6 text-center text-xs text-neutral-400">
          No photos uploaded yet
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((sequence) => {
            const capture = bySequence.get(sequence);
            return (
              <div
                key={sequence}
                className="aspect-square overflow-hidden rounded-md border border-neutral-200 bg-neutral-100"
              >
                {capture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={capture.imageUrl}
                    alt={`${dayPart.label} photo ${sequence}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                    Missing
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasAny && (
        <p className="mt-2 text-[10px] text-neutral-400">
          {captures[0].source === "automated" ? "Automated capture" : "Manually uploaded"}
        </p>
      )}
    </div>
  );
}
