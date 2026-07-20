"use client";

import { useCallback, useEffect, useState } from "react";
import { getCaptureEventsAction } from "@/lib/actions/captures";
import { todayStr } from "@/lib/date";
import type { CaptureEvent, CaptureEventAction, DayPart, Site } from "@/types";

const ACTION_LABELS: Record<CaptureEventAction, string> = {
  upload: "Uploaded",
  replace: "Replaced",
  delete: "Deleted",
  clear_day_part: "Cleared (day part)",
  rate: "Rated",
  flag: "Flagged",
  resolve_flag: "Resolved flag",
  purge: "Auto-deleted (retention)",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ActivityLog({ sites, dayParts }: { sites: Site[]; dayParts: DayPart[] }) {
  const dayPartLabelById = new Map(dayParts.map((dp) => [dp.id, dp.label]));
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? "");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [events, setEvents] = useState<CaptureEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!selectedSiteId || !selectedDate) return;
    setLoading(true);
    const result = await getCaptureEventsAction(selectedSiteId, selectedDate);
    setEvents(result.events);
    setError(result.error ?? null);
    setLoading(false);
  }, [selectedSiteId, selectedDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Site</label>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-bold text-body">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 rounded-brand border border-border-default px-2.5 text-[13px] text-body"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-brand border border-border-default bg-white">
        <div className="flex items-center justify-between border-b border-border-default bg-app px-5 py-3.5 text-[13px] font-bold text-navy">
          <span>Activity</span>
          {loading && <span className="text-[11px] font-normal text-muted">Loading...</span>}
        </div>
        {error ? (
          <p className="px-5 py-4 text-[13px] text-error">{error}</p>
        ) : events.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-secondary">
            No activity for this site and date yet.
          </p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left font-bold text-muted">
                <th className="px-5 py-2.5">When</th>
                <th className="px-5 py-2.5">Who</th>
                <th className="px-5 py-2.5">Action</th>
                <th className="px-5 py-2.5">Photo</th>
                <th className="px-5 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-border-subtle">
                  <td className="px-5 py-2.5 text-body">{formatTime(event.createdAt)}</td>
                  <td className="px-5 py-2.5 text-secondary">{event.actorEmail}</td>
                  <td className="px-5 py-2.5 text-secondary">{ACTION_LABELS[event.action]}</td>
                  <td className="px-5 py-2.5 text-secondary">
                    {dayPartLabelById.get(event.dayPartId) ?? "Unknown day part"}, photo {event.sequence}
                  </td>
                  <td className="px-5 py-2.5 text-secondary">{event.detail ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
