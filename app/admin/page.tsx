import { requireOrgAdmin } from "@/lib/auth";
import { listOrganisations, getOrganisation } from "@/lib/data/organisations";
import { listBrandsByOrganisation } from "@/lib/data/brands";
import { listSites } from "@/lib/data/sites";
import { listProfiles } from "@/lib/data/profiles";
import CreateOrganisationForm from "@/app/components/CreateOrganisationForm";
import OrgSwitcher from "@/app/components/OrgSwitcher";
import AddBrandForm from "@/app/components/AddBrandForm";
import AddSiteForm from "@/app/components/AddSiteForm";
import InviteUserForm from "@/app/components/InviteUserForm";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  org_admin: "Org admin",
  ops: "Ops",
  site_manager: "Site manager",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await requireOrgAdmin();
  const isSuperAdmin = user.role === "super_admin";

  const organisations = isSuperAdmin ? await listOrganisations() : [];
  const params = await searchParams;

  const selectedOrgId = isSuperAdmin
    ? params.org && organisations.some((o) => o.id === params.org)
      ? params.org
      : organisations[0]?.id
    : (user.organisationId ?? undefined);

  if (!selectedOrgId) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <h1 className="text-xl font-bold text-neutral-900">Admin</h1>
        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">
            Create the first organisation
          </h2>
          <CreateOrganisationForm />
        </section>
      </div>
    );
  }

  const selectedOrg = isSuperAdmin
    ? await getOrganisation(selectedOrgId)
    : null;

  const [brands, allSites, allProfiles] = await Promise.all([
    listBrandsByOrganisation(selectedOrgId),
    listSites(),
    listProfiles(),
  ]);

  const brandIds = new Set(brands.map((b) => b.id));
  const sites = allSites.filter((s) => brandIds.has(s.brandId));
  const siteIds = new Set(sites.map((s) => s.id));
  const profiles = allProfiles.filter(
    (p) =>
      p.organisationId === selectedOrgId ||
      (p.brandId && brandIds.has(p.brandId)) ||
      (p.siteId && siteIds.has(p.siteId))
  );

  const brandNameById = new Map(brands.map((b) => [b.id, b.name]));
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Admin</h1>
        {isSuperAdmin && organisations.length > 1 && (
          <OrgSwitcher organisations={organisations} selectedOrgId={selectedOrgId} />
        )}
      </div>

      {isSuperAdmin && (
        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">
            Create a new organisation
          </h2>
          <CreateOrganisationForm />
        </section>
      )}

      {isSuperAdmin && (
        <p className="text-sm text-neutral-500">
          Managing <span className="font-medium text-neutral-800">{selectedOrg?.name}</span>
        </p>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">Add a brand</h2>
        <AddBrandForm organisationId={selectedOrgId} />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">Add a site</h2>
        {brands.length === 0 ? (
          <p className="text-sm text-neutral-500">Add a brand first.</p>
        ) : (
          <AddSiteForm brands={brands} />
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">Invite a user</h2>
        <InviteUserForm
          organisationId={selectedOrgId}
          brands={brands}
          sites={sites}
          canInviteSuperAdmin={isSuperAdmin}
        />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">Brands</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="pb-2 font-medium">Name</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-2 text-neutral-800">{b.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">Sites</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Brand</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-2 text-neutral-800">{s.name}</td>
                <td className="py-2 text-neutral-500">{brandNameById.get(s.brandId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">Users</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Scope</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-2 text-neutral-800">{p.email}</td>
                <td className="py-2 text-neutral-500">{ROLE_LABELS[p.role]}</td>
                <td className="py-2 text-neutral-500">
                  {p.role === "org_admin"
                    ? "Whole organisation"
                    : p.siteId
                      ? siteNameById.get(p.siteId)
                      : p.brandId
                        ? brandNameById.get(p.brandId)
                        : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
