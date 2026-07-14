import { requireUser, sitesInScope } from "@/lib/auth";
import { listBrands } from "@/lib/data/brands";
import { listMenuItems } from "@/lib/data/menuItems";
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

  const [sites, brands, menuItems, dayParts] = await Promise.all([
    sitesInScope(),
    listBrands(),
    listMenuItems(),
    listDayParts(),
  ]);

  const defaultSiteId =
    params.site && sites.some((s) => s.id === params.site)
      ? params.site
      : sites[0]?.id;
  const defaultDate = params.date || todayStr();

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold text-navy">Upload photos</h1>
        <p className="text-sm leading-relaxed text-secondary">
          Replaces the old process of building a PDF and emailing it to ops —
          upload straight from site instead. New photos replace any existing
          ones for the same site, date and shift.
        </p>
      </div>

      {sites.length === 0 ? (
        <p className="rounded-brand border border-border-default bg-white p-6 text-sm text-secondary">
          No sites are assigned to your account yet. Contact an admin.
        </p>
      ) : (
        <div className="rounded-brand border border-border-default bg-white p-6">
          <UploadForm
            sites={sites}
            brands={brands}
            menuItems={menuItems}
            dayParts={dayParts}
            defaultSiteId={defaultSiteId}
            defaultDate={defaultDate}
          />
        </div>
      )}
    </div>
  );
}
