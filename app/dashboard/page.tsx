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
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Dashboard</h1>
        <Link
          href="/upload"
          className="hidden h-10 items-center rounded-brand bg-brand px-5 text-sm font-bold text-white hover:bg-brand-light md:flex"
        >
          Upload photos
        </Link>
      </div>

      {sites.length === 0 ? (
        <p className="rounded-brand border border-border-default bg-white p-6 text-sm text-secondary">
          No sites are assigned to your account yet. Contact an admin.
        </p>
      ) : (
        <>
          <div className="mb-6 rounded-brand border border-border-default bg-white p-5">
            <DashboardFilters
              sites={sites}
              brands={brands}
              selectedSiteId={selectedSiteId}
              selectedDate={selectedDate}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
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
