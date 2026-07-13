import type { Brand, Site } from "@/types";

export interface SiteGroup {
  brandName: string;
  sites: Site[];
}

/** Groups sites by brand, for rendering as <optgroup> in a site <select>. */
export function groupSitesByBrand(sites: Site[], brands: Brand[]): SiteGroup[] {
  const brandNameById = new Map(brands.map((b) => [b.id, b.name]));
  const groups = new Map<string, SiteGroup>();

  for (const site of sites) {
    const brandName = brandNameById.get(site.brandId) ?? "Other";
    if (!groups.has(site.brandId)) {
      groups.set(site.brandId, { brandName, sites: [] });
    }
    groups.get(site.brandId)!.sites.push(site);
  }

  return [...groups.values()].sort((a, b) => a.brandName.localeCompare(b.brandName));
}
