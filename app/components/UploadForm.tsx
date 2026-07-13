"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadCapturesAction, type UploadState } from "@/lib/actions/captures";
import { groupSitesByBrand } from "@/lib/siteGroups";
import type { Brand, DayPart, Site } from "@/types";

const initialState: UploadState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-60"
    >
      {pending ? "Uploading..." : "Upload photos"}
    </button>
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
    <form action={formAction} className="space-y-5" key={state.success ? "reset" : "form"}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="siteId" className="block text-sm font-medium text-neutral-700">
            Site
          </label>
          <select
            id="siteId"
            name="siteId"
            defaultValue={defaultSiteId}
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-neutral-700">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div>
          <label htmlFor="dayPart" className="block text-sm font-medium text-neutral-700">
            Day part
          </label>
          <select
            id="dayPart"
            name="dayPart"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {dayParts.map((dp) => (
              <option key={dp.id} value={dp.id}>
                {dp.label} ({dp.startTime}-{dp.endTime})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n}>
            <label
              htmlFor={`photo${n}`}
              className="block text-sm font-medium text-neutral-700"
            >
              Photo {n}
            </label>
            <input
              id={`photo${n}`}
              name={`photo${n}`}
              type="file"
              accept="image/*"
              required
              className="mt-1 w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
            />
          </div>
        ))}
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Uploaded. These photos have replaced any previous photos for this site,
          date, and day part.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
