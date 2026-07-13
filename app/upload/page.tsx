import Link from "next/link";
import { requireUser, sitesInScope } from "@/lib/auth";
import { listBrands } from "@/lib/data/brands";
import { listDayParts } from "@/lib/data/dayParts";
import { todayStr } from "@/lib/date";
import UploadForm from "@/app/components/UploadForm";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; date?: string }>;
}) {
  await requireUser();
  const params = await searchParams;

  const [sites, brands, dayParts] = await Promise.all([
    sitesInScope(),
    listBrands(),
    listDayParts(),
  ]);

  const defaultSiteId =
    params.site && sites.some((s) => s.id === params.site)
      ? params.site
      : sites[0]?.id;
  const defaultDate = params.date || todayStr();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Upload photos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Replaces the daily PDF and email step. Uploading three photos for a
            site, date, and day part replaces any photos already there.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-orange-600 hover:underline">
          View dashboard
        </Link>
      </div>

      {sites.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          No sites are assigned to your account yet. Contact an admin.
        </p>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <UploadForm
            sites={sites}
            brands={brands}
            dayParts={dayParts}
            defaultSiteId={defaultSiteId}
            defaultDate={defaultDate}
          />
        </div>
      )}
    </div>
  );
}
