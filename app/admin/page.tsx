import { requireSuperAdmin } from "@/lib/auth";
import { listOrganisations, getOrganisation } from "@/lib/data/organisations";
import { listBrandsByOrganisation } from "@/lib/data/brands";
import { listSites } from "@/lib/data/sites";
import { listProfiles } from "@/lib/data/profiles";
import { listMenuItems } from "@/lib/data/menuItems";
import { ROLE_LABELS } from "@/lib/roleLabels";
import CreateOrganisationForm from "@/app/components/CreateOrganisationForm";
import OrgSwitcher from "@/app/components/OrgSwitcher";
import AddBrandForm from "@/app/components/AddBrandForm";
import AddSiteForm from "@/app/components/AddSiteForm";
import AddMenuItemForm from "@/app/components/AddMenuItemForm";
import InviteUserForm from "@/app/components/InviteUserForm";
import ActivityLog from "@/app/components/ActivityLog";
import AdminTabs, { type AdminTab } from "@/app/components/AdminTabs";

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
  emptyMessage,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  return (
    <div className="overflow-hidden rounded-brand border border-border-default bg-white">
      <div className="border-b border-border-default bg-app px-5 py-3.5 text-[13px] font-bold text-navy">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-secondary">{emptyMessage}</p>
      ) : (
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
      )}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  await requireSuperAdmin();

  const organisations = await listOrganisations();
  const params = await searchParams;

  const selectedOrgId =
    params.org && organisations.some((o) => o.id === params.org)
      ? params.org
      : organisations[0]?.id;

  const allProfiles = await listProfiles();
  const opspotTeam = allProfiles.filter(
    (p) => p.role === "super_admin" || p.role === "agent"
  );

  if (!selectedOrgId) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 px-8 py-8">
        <h1 className="text-2xl font-extrabold text-navy">Admin</h1>
        <SectionCard title="Create the first organisation">
          <CreateOrganisationForm />
        </SectionCard>
        <DataTable
          title="OpSpot team"
          columns={["Email", "Role"]}
          emptyMessage="No OpSpot accounts yet."
          rows={opspotTeam.map((p) => [p.email, ROLE_LABELS[p.role]])}
        />
      </div>
    );
  }

  const selectedOrg = await getOrganisation(selectedOrgId);

  const [brands, allSites, allMenuItems] = await Promise.all([
    listBrandsByOrganisation(selectedOrgId),
    listSites(),
    listMenuItems(),
  ]);

  const brandIds = new Set(brands.map((b) => b.id));
  const sites = allSites.filter((s) => brandIds.has(s.brandId));
  const siteIds = new Set(sites.map((s) => s.id));
  const menuItems = allMenuItems.filter((m) => brandIds.has(m.brandId));
  const customerUsers = allProfiles.filter(
    (p) =>
      (p.brandId && brandIds.has(p.brandId)) || (p.siteId && siteIds.has(p.siteId))
  );

  const brandNameById = new Map(brands.map((b) => [b.id, b.name]));
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));

  const tabs: AdminTab[] = [
    {
      id: "brands-sites",
      label: "Brands & sites",
      content: (
        <>
          <SectionCard title="Add a brand">
            <AddBrandForm organisationId={selectedOrgId} />
          </SectionCard>
          <DataTable
            title="Brands"
            columns={["Name", "Sites"]}
            emptyMessage="No brands yet."
            rows={brands.map((b) => [
              b.name,
              String(sites.filter((s) => s.brandId === b.id).length),
            ])}
          />
          <SectionCard title="Add a site">
            {brands.length === 0 ? (
              <p className="text-[13px] text-secondary">Add a brand first.</p>
            ) : (
              <AddSiteForm brands={brands} />
            )}
          </SectionCard>
          <DataTable
            title="Sites"
            columns={["Name", "Brand"]}
            emptyMessage="No sites yet."
            rows={sites.map((s) => [s.name, brandNameById.get(s.brandId) ?? "-"])}
          />
        </>
      ),
    },
    {
      id: "menu-items",
      label: "Menu items",
      content: (
        <>
          <SectionCard title="Add a menu item">
            {brands.length === 0 ? (
              <p className="text-[13px] text-secondary">Add a brand first.</p>
            ) : (
              <AddMenuItemForm brands={brands} />
            )}
          </SectionCard>
          <div className="overflow-hidden rounded-brand border border-border-default bg-white">
            <div className="border-b border-border-default bg-app px-5 py-3.5 text-[13px] font-bold text-navy">
              Menu items
            </div>
            {menuItems.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-secondary">No menu items yet.</p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left font-bold text-muted">
                    <th className="px-5 py-2.5">Photo</th>
                    <th className="px-5 py-2.5">Name</th>
                    <th className="px-5 py-2.5">Brand</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr key={item.id} className="border-t border-border-subtle">
                      <td className="px-5 py-2.5">
                        {item.referenceImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.referenceImageUrl}
                            alt={item.name}
                            className="h-10 w-10 rounded-brand object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-brand bg-app" />
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-body">{item.name}</td>
                      <td className="px-5 py-2.5 text-secondary">
                        {brandNameById.get(item.brandId) ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ),
    },
    {
      id: "users",
      label: "Users",
      content: (
        <>
          <SectionCard title="Invite a user">
            <InviteUserForm brands={brands} sites={sites} />
          </SectionCard>
          <DataTable
            title="Customer users"
            columns={["Email", "Role", "Scope"]}
            emptyMessage="No users yet for this organisation."
            rows={customerUsers.map((p) => [
              p.email,
              ROLE_LABELS[p.role],
              (p.siteId ? siteNameById.get(p.siteId) : undefined) ??
                (p.brandId ? brandNameById.get(p.brandId) : undefined) ??
                "-",
            ])}
          />
          <DataTable
            title="OpSpot team"
            columns={["Email", "Role"]}
            emptyMessage="No OpSpot accounts yet."
            rows={opspotTeam.map((p) => [p.email, ROLE_LABELS[p.role]])}
          />
        </>
      ),
    },
    {
      id: "activity",
      label: "Activity",
      content: <ActivityLog sites={sites} />,
    },
    {
      id: "organisations",
      label: "Organisations",
      content: (
        <SectionCard title="Create a new organisation">
          <CreateOrganisationForm />
        </SectionCard>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Admin</h1>
        {organisations.length > 1 && (
          <OrgSwitcher organisations={organisations} selectedOrgId={selectedOrgId} />
        )}
      </div>

      <p className="mb-6 text-sm text-secondary">
        Managing <span className="font-semibold text-body">{selectedOrg?.name}</span>
      </p>

      <AdminTabs tabs={tabs} />
    </div>
  );
}
