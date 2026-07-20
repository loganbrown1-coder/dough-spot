import Link from "next/link";
import { requireUser, sitesInScope, canManageCaptures } from "@/lib/auth";
import { listBrands } from "@/lib/data/brands";
import { listMenuItems } from "@/lib/data/menuItems";
import { listDayParts } from "@/lib/data/dayParts";
import { listCapturesByDate } from "@/lib/data/captures";
import { todayStr } from "@/lib/date";
import { groupSitesByBrand } from "@/lib/siteGroups";
import DashboardFilters from "@/app/components/DashboardFilters";
import SiteSection from "@/app/components/SiteSection";
import type { DayPart, Site } from "@/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; date?: string; dayPart?: string; flagged?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [sites, brands, menuItems, allDayParts] = await Promise.all([
    sitesInScope(),
    listBrands(),
    listMenuItems(),
    listDayParts(),
  ]);

  // Day parts are per-organisation now, so which ones apply depends on
  // which site's organisation we're looking at - resolved per site via
  // its brand, rather than a single shared list like before.
  const orgIdByBrandId = new Map(brands.map((b) => [b.id, b.organisationId]));
  const dayPartsByOrgId = new Map<string, DayPart[]>();
  for (const dayPart of allDayParts) {
    const existing = dayPartsByOrgId.get(dayPart.organisationId);
    if (existing) existing.push(dayPart);
    else dayPartsByOrgId.set(dayPart.organisationId, [dayPart]);
  }
  function dayPartsForSite(site: Site): DayPart[] {
    const orgId = orgIdByBrandId.get(site.brandId);
    return orgId ? dayPartsByOrgId.get(orgId) ?? [] : [];
  }

  // Empty site param (the default) means "every site" - an overview -
  // rather than always jumping straight into one site.
  const selectedSiteId =
    params.site && sites.some((s) => s.id === params.site) ? params.site : "";
  const selectedDate = params.date || todayStr();
  const selectedSite = selectedSiteId ? sites.find((s) => s.id === selectedSiteId) : undefined;
  // The day part filter only applies (and only appears, see
  // DashboardFilters) once a single site is selected - otherwise there's
  // no single organisation's day parts to filter by.
  const siteDayParts = selectedSite ? dayPartsForSite(selectedSite) : [];
  const selectedDayPartId =
    params.dayPart && siteDayParts.some((dp) => dp.id === params.dayPart) ? params.dayPart : "";
  const visibleDayParts = selectedDayPartId
    ? siteDayParts.filter((dp) => dp.id === selectedDayPartId)
    : siteDayParts;
  const flaggedOnly = params.flagged === "1";

  const allCaptures = await listCapturesByDate(selectedDate);
  const captures = flaggedOnly ? allCaptures.filter((c) => c.flagged) : allCaptures;
  const capturesBySite = new Map<string, typeof captures>();
  for (const capture of captures) {
    const existing = capturesBySite.get(capture.siteId);
    if (existing) existing.push(capture);
    else capturesBySite.set(capture.siteId, [capture]);
  }
  const visibleSites = flaggedOnly
    ? sites.filter((s) => (capturesBySite.get(s.id)?.length ?? 0) > 0)
    : sites;

  const uploadHref = selectedSiteId
    ? `/upload?site=${selectedSiteId}&date=${selectedDate}`
    : "/upload";

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Dashboard</h1>
        {canManageCaptures(user.role) && (
          <Link
            href={uploadHref}
            className="hidden h-10 items-center rounded-brand bg-brand px-5 text-sm font-bold text-white hover:bg-brand-light lg:flex"
          >
            Upload photos
          </Link>
        )}
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
              dayParts={siteDayParts}
              selectedSiteId={selectedSiteId}
              selectedDate={selectedDate}
              selectedDayPartId={selectedDayPartId}
              flaggedOnly={flaggedOnly}
            />
          </div>

          {flaggedOnly && visibleSites.length === 0 ? (
            <p className="rounded-brand border border-border-default bg-white p-6 text-sm text-secondary">
              No flagged photos for this date.
            </p>
          ) : selectedSiteId ? (
            <SiteSection
              site={sites.find((s) => s.id === selectedSiteId)!}
              dayParts={visibleDayParts}
              captures={capturesBySite.get(selectedSiteId) ?? []}
              date={selectedDate}
              menuItems={menuItems}
              linkToFilter={false}
              viewerRole={user.role}
            />
          ) : (
            <div className="flex flex-col gap-8">
              {groupSitesByBrand(visibleSites, brands).map((group) => (
                <div key={group.brandName} className="flex flex-col gap-5">
                  <h2 className="text-lg font-extrabold text-navy">{group.brandName}</h2>
                  {group.sites.map((site) => (
                    <SiteSection
                      key={site.id}
                      site={site}
                      dayParts={dayPartsForSite(site)}
                      captures={capturesBySite.get(site.id) ?? []}
                      date={selectedDate}
                      menuItems={menuItems}
                      linkToFilter
                      viewerRole={user.role}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
