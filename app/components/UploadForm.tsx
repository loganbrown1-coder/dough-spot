"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  uploadCapturesAction,
  getExistingCapturesAction,
  type UploadState,
} from "@/lib/actions/captures";
import { compressImage } from "@/lib/compressImage";
import { groupSitesByBrand } from "@/lib/siteGroups";
import DayPartPhotoGrid from "@/app/components/DayPartPhotoGrid";
import type { Brand, Capture, DayPart, MenuItem, Site } from "@/types";

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const initialState: UploadState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[42px] self-start rounded-brand bg-brand px-6 font-bold text-white transition hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Uploading..." : "Upload photos"}
    </button>
  );
}

function PhotoDropzone({ n, menuItems }: { n: number; menuItems: MenuItem[] }) {
  const [status, setStatus] = useState<string | null>(null);
  const [menuItemId, setMenuItemId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedMenuItem = menuItems.find((m) => m.id === menuItemId);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setStatus(null);
      return;
    }

    setStatus("Compressing…");
    try {
      const compressed = await compressImage(file);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(compressed);
      if (inputRef.current) inputRef.current.files = dataTransfer.files;
      setStatus(`${compressed.name} (${formatSize(compressed.size)})`);
    } catch {
      // If compression fails for any reason, fall back to the original
      // file the browser already put in input.files - upload can proceed.
      setStatus(`${file.name} (${formatSize(file.size)})`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={`photo${n}`}
        className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-brand border-[1.5px] border-dashed border-border-default bg-[#FAFBFC] px-3 py-7 text-center"
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-brand bg-brand-bg text-brand">
          ↑
        </span>
        <span className="text-[13px] font-bold text-body">Photo {n}</span>
        <span className="max-w-full truncate text-xs text-secondary">
          {status ?? "Choose file"}
        </span>
        <input
          ref={inputRef}
          id={`photo${n}`}
          name={`photo${n}`}
          type="file"
          accept="image/*"
          required
          className="sr-only"
          onChange={handleChange}
        />
      </label>
      <select
        name={`menuItem${n}`}
        value={menuItemId}
        onChange={(e) => setMenuItemId(e.target.value)}
        className="h-9 rounded-brand border border-border-default px-2.5 text-xs text-body"
      >
        <option value="">No menu item</option>
        {menuItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {selectedMenuItem?.referenceImageUrl && (
        <div className="flex flex-col items-center gap-2 rounded-brand border border-border-default bg-app p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedMenuItem.referenceImageUrl}
            alt={`Reference: ${selectedMenuItem.name}`}
            className="h-28 w-28 rounded-brand object-cover"
          />
          <span className="text-[11px] text-secondary">
            Reference for <span className="font-semibold text-body">{selectedMenuItem.name}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default function UploadForm({
  sites,
  brands,
  menuItems,
  dayParts,
  defaultSiteId,
  defaultDate,
}: {
  sites: Site[];
  brands: Brand[];
  menuItems: MenuItem[];
  dayParts: DayPart[];
  defaultSiteId?: string;
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(uploadCapturesAction, initialState);
  const groups = groupSitesByBrand(sites, brands);
  const [selectedSiteId, setSelectedSiteId] = useState(defaultSiteId ?? sites[0]?.id);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedDayPartId, setSelectedDayPartId] = useState(dayParts[0]?.id ?? "");

  const selectedBrandId = sites.find((s) => s.id === selectedSiteId)?.brandId;
  const availableMenuItems = menuItems.filter((m) => m.brandId === selectedBrandId);
  const selectedDayPart = dayParts.find((dp) => dp.id === selectedDayPartId);

  const [existingCaptures, setExistingCaptures] = useState<Capture[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const dayPartComplete = existingCaptures.length === 3;

  const refetchExisting = useCallback(async () => {
    if (!selectedSiteId || !selectedDate || !selectedDayPartId) return;
    setLoadingExisting(true);
    const result = await getExistingCapturesAction(selectedSiteId, selectedDate, selectedDayPartId);
    setExistingCaptures(result.captures);
    setLoadingExisting(false);
  }, [selectedSiteId, selectedDate, selectedDayPartId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetchExisting();
  }, [refetchExisting]);

  useEffect(() => {
    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refetchExisting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-5" key={state.success ? "reset" : "form"}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="siteId" className="text-[13px] font-bold text-body">
            Site
          </label>
          <select
            id="siteId"
            name="siteId"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            required
            className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
          >
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
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="date" className="text-[13px] font-bold text-body">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            required
            className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="dayPart" className="text-[13px] font-bold text-body">
            Day part
          </label>
          <select
            id="dayPart"
            name="dayPart"
            value={selectedDayPartId}
            onChange={(e) => setSelectedDayPartId(e.target.value)}
            required
            className="h-10 rounded-brand border border-border-default px-3 text-sm text-body"
          >
            {dayParts.map((dp) => (
              <option key={dp.id} value={dp.id}>
                {dp.label} ({dp.startTime}-{dp.endTime})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDayPart && (
        <div className="flex flex-col gap-2.5 rounded-brand border border-border-default bg-app p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-bold text-body">
              Current photos for this shift
            </h2>
            {loadingExisting && (
              <span className="text-[11px] text-muted">Loading...</span>
            )}
          </div>
          <DayPartPhotoGrid
            siteId={selectedSiteId}
            date={selectedDate}
            dayPartId={selectedDayPartId}
            dayPartLabel={selectedDayPart.label}
            captures={existingCaptures}
            menuItems={availableMenuItems}
            readOnly={false}
            onChanged={refetchExisting}
          />
        </div>
      )}

      {dayPartComplete ? (
        <p className="text-[13px] text-secondary">
          All 3 photos are in for this shift. Use Replace or Delete above to make changes.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <PhotoDropzone key={n} n={n} menuItems={availableMenuItems} />
            ))}
          </div>

          {state.error && (
            <p className="rounded-brand border border-error-border bg-error-bg px-3 py-2.5 text-[13px] text-error">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="rounded-brand border border-success-border bg-success-bg px-4 py-3 text-[13px] font-semibold text-success">
              ✓ Upload complete — these photos replaced any previous photos for this
              site, date and shift.
            </p>
          )}

          <SubmitButton />
        </>
      )}
    </form>
  );
}
