import Link from "next/link";
import { requireUser, sitesInScope, canManageCaptures } from "@/lib/auth";
import { listBrands } from "@/lib/data/brands";
import { listMenuItems } from "@/lib/data/menuItems";
import { listDayParts } from "@/lib/data/dayParts";
import {
  listCapturesByDate,
  listCapturesAllDates,
  getMostRecentCaptureDate,
} from "@/lib/data/captures";
import { listLatestQualityAssessments } from "@/lib/data/qualityAssessments";
import { todayStr, formatDateLabel } from "@/lib/date";
import { groupSitesByBrand } from "@/lib/siteGroups";
import DashboardFilters from "@/app/components/DashboardFilters";
import SiteSection, { type DateRow } from "@/app/components/SiteSection";
import type { Capture, DayPart, Site } from "@/types";

function groupByDate(captures: Capture[]): DateRow[] {
  const byDate = new Map<string, Capture[]>();
  for (const capture of captures) {
    const existing = byDate.get(capture.date);
    if (existing) existing.push(capture);
    else byDate.set(capture.date, [capture]);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dateCaptures]) => ({ date, captures: dateCaptures }));
}

/** Every date with at least one capture, newest first - the "All dates" overview's outer grouping. */
function distinctDates(captures: Capture[]): string[] {
  return [...new Set(captures.map((c) => c.date))].sort((a, b) => (a < b ? 1 : -1));
}

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
  const selectedSite = selectedSiteId ? sites.find((s) => s.id === selectedSiteId) : undefined;
  // date=all is an explicit choice to browse every date. Landing here with
  // no date param at all (fresh login, or clicking "Dashboard" in the nav)
  // instead defaults to whichever day most recently had any photos
  // uploaded (typically yesterday) rather than an empty "today" - a pure
  // read, scoped by RLS to sites this caller can see; falls back to today
  // if nothing's ever been uploaded yet. Every filter interaction in
  // DashboardFilters always writes an explicit date param, so this lookup
  // only ever runs on first landing.
  const allDates = params.date === "all";
  const mostRecentDate =
    params.date === undefined && !allDates ? await getMostRecentCaptureDate() : null;
  const selectedDate = allDates ? "" : params.date || mostRecentDate || todayStr();

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

  const allCaptures = allDates
    ? await listCapturesAllDates({ siteId: selectedSiteId || undefined })
    : await listCapturesByDate(selectedDate);
  const captures = flaggedOnly ? allCaptures.filter((c) => c.flagged) : allCaptures;

  // Converted from Map to a plain object here - a Map isn't a type Next.js
  // can serialize across the server/client boundary, and this needs to
  // reach DayPartPhotoGrid/CaptureTile, both client components.
  const qualityByCaptureId = Object.fromEntries(
    await listLatestQualityAssessments(captures.map((c) => c.id))
  );

  const capturesBySite = new Map<string, Capture[]>();
  for (const capture of captures) {
    const existing = capturesBySite.get(capture.siteId);
    if (existing) existing.push(capture);
    else capturesBySite.set(capture.siteId, [capture]);
  }
  // In "All dates" mode a site's rows are one per date that actually has
  // photos; otherwise it's always exactly one row, for the selected date
  // (even when empty - SiteSection decides whether that's worth collapsing).
  function dateRowsForSite(siteId: string): DateRow[] {
    return allDates
      ? groupByDate(capturesBySite.get(siteId) ?? [])
      : [{ date: selectedDate, captures: capturesBySite.get(siteId) ?? [] }];
  }

  const visibleSites = flaggedOnly
    ? sites.filter((s) => (capturesBySite.get(s.id)?.length ?? 0) > 0)
    : sites;

  // The date value to carry into a "click site name to filter" link -
  // preserves All-dates mode instead of snapping back to a single date.
  const linkDate = allDates ? "all" : selectedDate;

  const uploadHref = selectedSiteId
    ? `/upload?site=${selectedSiteId}&date=${allDates ? todayStr() : selectedDate}`
    : "/upload";

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Home Page</h1>
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
              allDates={allDates}
              selectedDayPartId={selectedDayPartId}
              flaggedOnly={flaggedOnly}
            />
          </div>

          {flaggedOnly && visibleSites.length === 0 ? (
            <p className="rounded-brand border border-border-default bg-white p-6 text-sm text-secondary">
              No flagged photos.
            </p>
          ) : selectedSiteId ? (
            <SiteSection
              site={sites.find((s) => s.id === selectedSiteId)!}
              dayParts={visibleDayParts}
              dateRows={dateRowsForSite(selectedSiteId)}
              menuItems={menuItems}
              qualityByCaptureId={qualityByCaptureId}
              linkToFilter={false}
              linkDate={linkDate}
              showDateLabels={allDates}
              viewerRole={user.role}
            />
          ) : allDates ? (
            // Date-major: one heading per date (newest first), every site's
            // photos for that day underneath, then the next date below -
            // instead of one heading per site with every date stacked under
            // it, which meant scrolling through one site's whole history
            // before reaching the next site at all.
            <div className="flex flex-col gap-10">
              {distinctDates(captures).map((date) => (
                <div key={date} className="flex flex-col gap-5">
                  <h2 className="text-xl font-extrabold text-navy">{formatDateLabel(date)}</h2>
                  <div className="flex flex-col gap-8">
                    {groupSitesByBrand(visibleSites, brands).map((group) => {
                      const brand = brands.find((b) => b.id === group.sites[0]?.brandId);
                      return (
                        <div key={group.brandName} className="flex flex-col gap-5">
                          <div className="flex items-center gap-2.5">
                            {brand?.logoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={brand.logoUrl}
                                alt=""
                                className="h-8 w-8 rounded object-contain"
                              />
                            )}
                            <h3 className="text-lg font-extrabold text-navy">{group.brandName}</h3>
                          </div>
                          {group.sites.map((site) => (
                            <SiteSection
                              key={site.id}
                              site={site}
                              dayParts={dayPartsForSite(site)}
                              dateRows={[
                                {
                                  date,
                                  captures: (capturesBySite.get(site.id) ?? []).filter(
                                    (c) => c.date === date
                                  ),
                                },
                              ]}
                              menuItems={menuItems}
                              qualityByCaptureId={qualityByCaptureId}
                              linkToFilter
                              linkDate={date}
                              showDateLabels={false}
                              viewerRole={user.role}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {groupSitesByBrand(visibleSites, brands).map((group) => {
                const brand = brands.find((b) => b.id === group.sites[0]?.brandId);
                return (
                <div key={group.brandName} className="flex flex-col gap-5">
                  <div className="flex items-center gap-2.5">
                    {brand?.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded object-contain"
                      />
                    )}
                    <h2 className="text-lg font-extrabold text-navy">{group.brandName}</h2>
                  </div>
                  {group.sites.map((site) => (
                    <SiteSection
                      key={site.id}
                      site={site}
                      dayParts={dayPartsForSite(site)}
                      dateRows={dateRowsForSite(site.id)}
                      menuItems={menuItems}
                      qualityByCaptureId={qualityByCaptureId}
                      linkToFilter
                      linkDate={linkDate}
                      showDateLabels={false}
                      viewerRole={user.role}
                    />
                  ))}
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
