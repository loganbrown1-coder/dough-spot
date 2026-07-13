import { requireOrgAdmin } from "@/lib/auth";
import { listOrganisations, getOrganisation } from "@/lib/data/organisations";
import { listBrandsByOrganisation } from "@/lib/data/brands";
import { listSites } from "@/lib/data/sites";
import { listProfiles } from "@/lib/data/profiles";
import { ROLE_LABELS } from "@/lib/roleLabels";
import CreateOrganisationForm from "@/app/components/CreateOrganisationForm";
import OrgSwitcher from "@/app/components/OrgSwitcher";
import AddBrandForm from "@/app/components/AddBrandForm";
import AddSiteForm from "@/app/components/AddSiteForm";
import InviteUserForm from "@/app/components/InviteUserForm";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-brand border border-border-default bg-white p-5">
      <div className="border-l-[3px] border-l-brand pl-2.5 text-sm font-bold text-navy">
        {title}
      </div>
      {children}
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-brand border border-border-default bg-white">
      <div className="border-b border-border-default bg-app px-5 py-3.5 text-[13px] font-bold text-navy">
        {title}
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left font-bold text-muted">
            {columns.map((col) => (
              <th key={col} className="px-5 py-2.5">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border-subtle">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-5 py-2.5 ${j === 0 ? "text-body" : "text-secondary"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
      <div className="mx-auto w-full max-w-4xl space-y-6 px-8 py-8">
        <h1 className="text-2xl font-extrabold text-navy">Admin</h1>
        <SectionCard title="Create the first organisation">
          <CreateOrganisationForm />
        </SectionCard>
      </div>
    );
  }

  const selectedOrg = isSuperAdmin ? await getOrganisation(selectedOrgId) : null;

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
    <div className="mx-auto w-full max-w-4xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Admin</h1>
        {isSuperAdmin && organisations.length > 1 && (
          <OrgSwitcher organisations={organisations} selectedOrgId={selectedOrgId} />
        )}
      </div>

      {isSuperAdmin && (
        <SectionCard title="Create a new organisation">
          <CreateOrganisationForm />
        </SectionCard>
      )}

      {isSuperAdmin && (
        <p className="text-sm text-secondary">
          Managing <span className="font-semibold text-body">{selectedOrg?.name}</span>
        </p>
      )}

      <div className="flex flex-col gap-4">
        <SectionCard title="Add a brand">
          <AddBrandForm organisationId={selectedOrgId} />
        </SectionCard>

        <SectionCard title="Add a site">
          {brands.length === 0 ? (
            <p className="text-[13px] text-secondary">Add a brand first.</p>
          ) : (
            <AddSiteForm brands={brands} />
          )}
        </SectionCard>

        <SectionCard title="Invite a user">
          <InviteUserForm
            organisationId={selectedOrgId}
            brands={brands}
            sites={sites}
            canInviteSuperAdmin={isSuperAdmin}
          />
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <DataTable
          title="Brands"
          columns={["Name", "Sites"]}
          rows={brands.map((b) => [
            b.name,
            String(sites.filter((s) => s.brandId === b.id).length),
          ])}
        />

        <DataTable
          title="Sites"
          columns={["Name", "Brand"]}
          rows={sites.map((s) => [s.name, brandNameById.get(s.brandId) ?? "-"])}
        />

        <DataTable
          title="Users"
          columns={["Email", "Role", "Scope"]}
          rows={profiles.map((p) => [
            p.email,
            ROLE_LABELS[p.role],
            p.role === "org_admin"
              ? "Whole organisation"
              : (p.siteId ? siteNameById.get(p.siteId) : undefined) ??
                (p.brandId ? brandNameById.get(p.brandId) : undefined) ??
                "-",
          ])}
        />
      </div>
    </div>
  );
}
