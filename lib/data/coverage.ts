import { listCapturesByDate } from "@/lib/data/captures";
import { sitesInScope } from "@/lib/auth";
import { listBrands } from "@/lib/data/brands";
import { listDayParts } from "@/lib/data/dayParts";
import type { Capture, DayPart, Site } from "@/types";

export type CoverageStatus = "complete" | "needs_review" | "incomplete";

export interface DayPartCoverage {
  dayPart: DayPart;
  count: number;
}

const THUMBNAIL_PREVIEW_COUNT = 3;

export interface SiteCoverage {
  site: Site;
  dayPartCoverage: DayPartCoverage[];
  photoCount: number;
  flagCount: number;
  /** Captures with no menu_item_id tagged - "unmatched". */
  unmatchedCount: number;
  status: CoverageStatus;
  lastUploadAt: string | null;
  /** First few of the site's captures for this date, for the card's thumbnail row - already signed (listCapturesByDate signs every row), so nothing extra to fetch. */
  previewCaptures: Capture[];
}

export interface CoverageSummary {
  date: string;
  sites: SiteCoverage[];
  photoCount: number;
  sitesReported: number;
  sitesTotal: number;
  dayPartsMissing: number;
  openFlags: number;
  unmatchedItems: number;
  lastUpload: { at: string; siteName: string } | null;
}

/**
 * One row per site the caller can see, for a single date - the dashboard's
 * "site board" and the sidebar's site list both read from this, so their
 * status/counts always agree with each other. Status rules, inferred from
 * the design (not written down anywhere else, so worth stating plainly):
 *   - "incomplete": at least one of the site's day parts has zero photos.
 *   - "needs_review": every day part has at least one photo, but something
 *     here needs a human's attention (currently: any unmatched-menu-item
 *     photo). Flags alone do NOT trigger this - a site with all day parts
 *     covered and no unmatched items reads as "complete" even with an open
 *     flag, matching the design's own Cambridge example (1 flag, still
 *     "Complete").
 *   - "complete": everything else.
 */
export async function getCoverageForDate(date: string): Promise<CoverageSummary> {
  const [sites, captures, brands, allDayParts] = await Promise.all([
    sitesInScope(),
    listCapturesByDate(date),
    listBrands(),
    listDayParts(),
  ]);

  const dayPartsByOrgId = new Map<string, DayPart[]>();
  for (const dayPart of allDayParts) {
    const existing = dayPartsByOrgId.get(dayPart.organisationId);
    if (existing) existing.push(dayPart);
    else dayPartsByOrgId.set(dayPart.organisationId, [dayPart]);
  }

  const capturesBySite = new Map<string, Capture[]>();
  for (const capture of captures) {
    const existing = capturesBySite.get(capture.siteId);
    if (existing) existing.push(capture);
    else capturesBySite.set(capture.siteId, [capture]);
  }

  const brandById = new Map(brands.map((b) => [b.id, b]));

  const siteCoverage: SiteCoverage[] = sites.map((site) => {
    const brand = brandById.get(site.brandId);
    const orgId = brand?.organisationId;
    const dayParts = orgId ? dayPartsByOrgId.get(orgId) ?? [] : [];
    const siteCaptures = capturesBySite.get(site.id) ?? [];

    const dayPartCoverage: DayPartCoverage[] = dayParts.map((dayPart) => ({
      dayPart,
      count: siteCaptures.filter((c) => c.dayPartId === dayPart.id).length,
    }));

    const flagCount = siteCaptures.filter((c) => c.flagged).length;
    const unmatchedCount = siteCaptures.filter((c) => !c.menuItemId).length;
    const missingDayPart = dayPartCoverage.some((d) => d.count === 0);

    const status: CoverageStatus = missingDayPart
      ? "incomplete"
      : unmatchedCount > 0
        ? "needs_review"
        : "complete";

    const lastUploadAt = siteCaptures.reduce<string | null>((latest, c) => {
      return !latest || c.capturedAt > latest ? c.capturedAt : latest;
    }, null);

    return {
      site,
      dayPartCoverage,
      photoCount: siteCaptures.length,
      flagCount,
      unmatchedCount,
      status,
      lastUploadAt,
      previewCaptures: siteCaptures.slice(0, THUMBNAIL_PREVIEW_COUNT),
    };
  });

  let lastUpload: CoverageSummary["lastUpload"] = null;
  for (const s of siteCoverage) {
    if (s.lastUploadAt && (!lastUpload || s.lastUploadAt > lastUpload.at)) {
      lastUpload = { at: s.lastUploadAt, siteName: s.site.name };
    }
  }

  return {
    date,
    sites: siteCoverage,
    photoCount: captures.length,
    sitesReported: siteCoverage.filter((s) => s.photoCount > 0).length,
    sitesTotal: sites.length,
    dayPartsMissing: siteCoverage.reduce(
      (n, s) => n + s.dayPartCoverage.filter((d) => d.count === 0).length,
      0
    ),
    openFlags: siteCoverage.reduce((n, s) => n + s.flagCount, 0),
    unmatchedItems: siteCoverage.reduce((n, s) => n + s.unmatchedCount, 0),
    lastUpload,
  };
}
