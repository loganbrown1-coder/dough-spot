"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadCapturesAction, type UploadState } from "@/lib/actions/captures";
import { compressImage } from "@/lib/compressImage";
import { groupSitesByBrand } from "@/lib/siteGroups";
import type { Brand, DayPart, Site } from "@/types";

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

function PhotoDropzone({ n }: { n: number }) {
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  );
}

export default function UploadForm({
  sites,
  brands,
  dayParts,
  defaultSiteId,
  defaultDate,
}: {
  sites: Site[];
  brands: Brand[];
  dayParts: DayPart[];
  defaultSiteId?: string;
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(uploadCapturesAction, initialState);
  const groups = groupSitesByBrand(sites, brands);

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
            defaultValue={defaultSiteId}
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
            defaultValue={defaultDate}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <PhotoDropzone key={n} n={n} />
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
    </form>
  );
}
