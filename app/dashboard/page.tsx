import Link from "next/link";
import { requireUser, sitesInScope } from "@/lib/auth";
import { listBrands } from "@/lib/data/brands";
import { listDayParts } from "@/lib/data/dayParts";
import { listCaptures } from "@/lib/data/captures";
import { todayStr } from "@/lib/date";
import DashboardFilters from "@/app/components/DashboardFilters";
import DayPartCard from "@/app/components/DayPartCard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; date?: string }>;
}) {
  await requireUser();
  const params = await searchParams;

  const [sites, brands] = await Promise.all([sitesInScope(), listBrands()]);
  const selectedSiteId =
    params.site && sites.some((s) => s.id === params.site)
      ? params.site
      : sites[0]?.id;
  const selectedDate = params.date || todayStr();

  const dayParts = await listDayParts();
  const captures = selectedSiteId
    ? await listCaptures({ siteId: selectedSiteId, date: selectedDate })
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Dashboard</h1>
        <Link
          href="/upload"
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          Upload photos
        </Link>
      </div>

      {sites.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          No sites are assigned to your account yet. Contact an admin.
        </p>
      ) : (
        <>
          <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <DashboardFilters
              sites={sites}
              brands={brands}
              selectedSiteId={selectedSiteId}
              selectedDate={selectedDate}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {dayParts.map((dayPart) => (
              <DayPartCard
                key={dayPart.id}
                dayPart={dayPart}
                captures={captures.filter((c) => c.dayPartId === dayPart.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
