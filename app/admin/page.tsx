import { requireSuperAdmin } from "@/lib/auth";
import { listOrganisations, getOrganisation } from "@/lib/data/organisations";
import { listBrandsByOrganisation } from "@/lib/data/brands";
import { listSites } from "@/lib/data/sites";
import { listProfiles } from "@/lib/data/profiles";
import { listMenuItems } from "@/lib/data/menuItems";
import { listDayPartsByOrganisation } from "@/lib/data/dayParts";
import { renameBrandAction, renameSiteAction, renameMenuItemAction } from "@/lib/actions/admin";
import CreateOrganisationForm from "@/app/components/CreateOrganisationForm";
import OrgSwitcher from "@/app/components/OrgSwitcher";
import AddBrandForm from "@/app/components/AddBrandForm";
import AddSiteForm from "@/app/components/AddSiteForm";
import AddMenuItemForm from "@/app/components/AddMenuItemForm";
import AddDayPartForm from "@/app/components/AddDayPartForm";
import DayPartRow from "@/app/components/DayPartRow";
import InviteUserForm from "@/app/components/InviteUserForm";
import InviteOpspotUserForm from "@/app/components/InviteOpspotUserForm";
import ActivityLog from "@/app/components/ActivityLog";
import RenameField from "@/app/components/RenameField";
import DeleteSiteButton from "@/app/components/DeleteSiteButton";
import RetentionField from "@/app/components/RetentionField";
import UsersTable from "@/app/components/UsersTable";
import AdminTabs, { type AdminTab } from "@/app/components/AdminTabs";
import type { Organisation } from "@/types";

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
  rows: React.ReactNode[][];
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

/**
 * Shown at the top of every tab that's actually scoped to one customer
 * (Brands & sites, Menu items, Users, Activity) - never on OpSpot Team or
 * Organisations, since those aren't about any single customer.
 */
function OrgContextBanner({
  orgName,
  organisations,
  selectedOrgId,
}: {
  orgName: string | undefined;
  organisations: Organisation[];
  selectedOrgId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-brand border border-border-default bg-app px-4 py-2.5">
      <p className="text-[13px] text-secondary">
        Managing <span className="font-semibold text-body">{orgName}</span>
      </p>
      {organisations.length > 1 && (
        <OrgSwitcher organisations={organisations} selectedOrgId={selectedOrgId} />
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

  const tabs: AdminTab[] = [];

  if (selectedOrgId) {
    const selectedOrg = await getOrganisation(selectedOrgId);

    const [brands, allSites, allMenuItems, dayParts] = await Promise.all([
      listBrandsByOrganisation(selectedOrgId),
      listSites(),
      listMenuItems(),
      listDayPartsByOrganisation(selectedOrgId),
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

    const banner = (
      <OrgContextBanner
        orgName={selectedOrg?.name}
        organisations={organisations}
        selectedOrgId={selectedOrgId}
      />
    );

    tabs.push(
      {
        id: "brands-sites",
        label: "Brands & sites",
        content: (
          <>
            {banner}
            <SectionCard title="Add a brand">
              <AddBrandForm organisationId={selectedOrgId} />
            </SectionCard>
            <DataTable
              title="Brands"
              columns={["Name", "Sites"]}
              emptyMessage="No brands yet."
              rows={brands.map((b) => [
                <RenameField key={b.id} id={b.id} name={b.name} action={renameBrandAction} />,
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
              columns={["Name", "Brand", "Actions"]}
              emptyMessage="No sites yet."
              rows={sites.map((s) => [
                <RenameField key={s.id} id={s.id} name={s.name} action={renameSiteAction} />,
                brandNameById.get(s.brandId) ?? "-",
                <DeleteSiteButton key={s.id} id={s.id} name={s.name} />,
              ])}
            />
            <SectionCard title="Add a day part">
              <AddDayPartForm organisationId={selectedOrgId} />
            </SectionCard>
            <div className="overflow-hidden rounded-brand border border-border-default bg-white">
              <div className="border-b border-border-default bg-app px-5 py-3.5 text-[13px] font-bold text-navy">
                Day parts
              </div>
              {dayParts.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-secondary">No day parts yet.</p>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left font-bold text-muted">
                      <th className="px-5 py-2.5">Label</th>
                      <th className="px-5 py-2.5">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayParts.map((dp) => (
                      <DayPartRow key={dp.id} dayPart={dp} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ),
      },
      {
        id: "menu-items",
        label: "Menu items",
        content: (
          <>
            {banner}
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
                        <td className="px-5 py-2.5 text-body">
                          <RenameField id={item.id} name={item.name} action={renameMenuItemAction} />
                        </td>
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
            {banner}
            <SectionCard title="Invite a user">
              <InviteUserForm brands={brands} sites={sites} />
            </SectionCard>
            <UsersTable
              title="Customer users"
              users={customerUsers}
              brands={brands}
              sites={sites}
              emptyMessage="No users yet for this organisation."
            />
          </>
        ),
      },
      {
        id: "activity",
        label: "Activity",
        content: (
          <>
            {banner}
            <ActivityLog sites={sites} dayParts={dayParts} />
          </>
        ),
      }
    );
  }

  tabs.push(
    {
      id: "organisations",
      label: "Organisations",
      content: (
        <>
          <SectionCard title="Create a new organisation">
            <CreateOrganisationForm />
          </SectionCard>
          <div className="overflow-hidden rounded-brand border border-border-default bg-white">
            <div className="border-b border-border-default bg-app px-5 py-3.5 text-[13px] font-bold text-navy">
              Organisations
            </div>
            {organisations.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-secondary">No organisations yet.</p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left font-bold text-muted">
                    <th className="px-5 py-2.5">Name</th>
                    <th className="px-5 py-2.5">Photo retention</th>
                  </tr>
                </thead>
                <tbody>
                  {organisations.map((org) => (
                    <tr key={org.id} className="border-t border-border-subtle">
                      <td className="px-5 py-2.5 text-body">{org.name}</td>
                      <td className="px-5 py-2.5">
                        <RetentionField organisationId={org.id} retentionDays={org.retentionDays} />
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
      id: "opspot-team",
      label: "OpSpot Team",
      content: (
        <>
          <SectionCard title="Invite an OpSpot team member">
            <InviteOpspotUserForm />
          </SectionCard>
          <UsersTable
            title="OpSpot team"
            users={opspotTeam}
            brands={[]}
            sites={[]}
            emptyMessage="No OpSpot accounts yet."
          />
        </>
      ),
    }
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-navy">Admin</h1>
      <AdminTabs tabs={tabs} />
    </div>
  );
}
