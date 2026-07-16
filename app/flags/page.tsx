import { requireUploader } from "@/lib/auth";
import { listFlaggedCaptures } from "@/lib/data/captures";
import { listSites } from "@/lib/data/sites";
import { listBrands } from "@/lib/data/brands";
import { listOrganisations } from "@/lib/data/organisations";
import { listMenuItems } from "@/lib/data/menuItems";
import FlaggedInbox, { type FlaggedItem } from "@/app/components/FlaggedInbox";

const DAY_PART_LABELS: Record<string, string> = {
  A: "Day Part A",
  B: "Day Part B",
  C: "Day Part C",
};

export default async function FlagsPage() {
  await requireUploader();

  const [captures, sites, brands, organisations, menuItems] = await Promise.all([
    listFlaggedCaptures(),
    listSites(),
    listBrands(),
    listOrganisations(),
    listMenuItems(),
  ]);

  const siteById = new Map(sites.map((s) => [s.id, s]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const orgById = new Map(organisations.map((o) => [o.id, o]));
  const menuItemsByBrandId = new Map<string, typeof menuItems>();
  for (const item of menuItems) {
    const existing = menuItemsByBrandId.get(item.brandId);
    if (existing) existing.push(item);
    else menuItemsByBrandId.set(item.brandId, [item]);
  }

  const items: FlaggedItem[] = captures.map((capture) => {
    const site = siteById.get(capture.siteId);
    const brand = site ? brandById.get(site.brandId) : undefined;
    const org = brand ? orgById.get(brand.organisationId) : undefined;
    return {
      capture,
      siteName: site?.name ?? "Unknown site",
      orgName: org?.name,
      dayPartLabel: DAY_PART_LABELS[capture.dayPartId] ?? capture.dayPartId,
      menuItems: brand ? menuItemsByBrandId.get(brand.id) ?? [] : [],
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-8">
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold text-navy">Flagged photos</h1>
        <p className="text-sm leading-relaxed text-secondary">
          Every flagged photo across every site, newest first. Resolve once you&apos;ve
          reviewed or fixed the issue.
        </p>
      </div>

      <FlaggedInbox items={items} />
    </div>
  );
}
