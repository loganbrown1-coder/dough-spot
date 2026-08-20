import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { canManageCaptures } from "@/lib/auth";
import { getCoverageForDate, type CoverageStatus } from "@/lib/data/coverage";
import { countFlaggedCaptures, getMostRecentCaptureDate } from "@/lib/data/captures";
import { todayStr } from "@/lib/date";
import { ROLE_LABELS } from "@/lib/roleLabels";
import LogoMark from "@/app/components/LogoMark";
import SidebarLinks from "@/app/components/SidebarLinks";
import type { Profile } from "@/types";

function initialsFor(email: string): string {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

const STATUS_DOT: Record<CoverageStatus, string> = {
  incomplete: "bg-error",
  needs_review: "bg-amber-500",
  complete: "bg-success",
};

export default async function Nav({ user }: { user: Profile | null }) {
  if (!user) return null;

  const showAdmin = user.role === "super_admin";
  const showUpload = canManageCaptures(user.role);

  // Only the sidebar (desktop) needs this - the mobile header below doesn't
  // show a site list at all, so there's no point fetching it for a mobile
  // visit. Runs on every desktop page view, not just the dashboard, since
  // the sidebar is global - see the coverage-status doc comment in
  // lib/data/coverage.ts for what each dot means. Cheap at today's data
  // volume (the same query the dashboard itself already runs), but worth
  // knowing this is now a per-page-load query sitewide, not dashboard-only,
  // if photo volume grows a lot.
  //
  // Uses the same "most recent upload date, falling back to today" default
  // as the dashboard's own landing state (getMostRecentCaptureDate) rather
  // than always today - otherwise the sidebar's dots and the dashboard's
  // coverage cards silently disagree on which day they're describing
  // whenever nothing's been uploaded yet today (the sidebar would show every
  // site red while the dashboard shows real status for its own default
  // date). They can still diverge if someone explicitly picks a different
  // date on the dashboard - the sidebar always reflects the default day,
  // not whatever's currently filtered.
  const [mostRecentDate, openFlagCount] = await Promise.all([
    getMostRecentCaptureDate(),
    showUpload ? countFlaggedCaptures() : Promise.resolve(undefined),
  ]);
  const coverage = await getCoverageForDate(mostRecentDate ?? todayStr());

  return (
    <header className="bg-navy lg:flex lg:h-full lg:w-[212px] lg:flex-none lg:flex-col lg:py-4">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:h-full lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-4 pb-5">
          <LogoMark className="h-8 w-8" />
          <span className="flex flex-col leading-none">
            <span className="text-[13px] font-extrabold tracking-wide text-white">
              DOUGH SPOT
            </span>
            <span className="mt-1 text-[9.5px] font-semibold text-white/50">
              Powered by OpSpot
            </span>
          </span>
        </Link>

        <SidebarLinks showUpload={showUpload} showAdmin={showAdmin} openFlagCount={openFlagCount} />

        {coverage.sites.length > 0 && (
          <div className="mt-5 flex-1 overflow-y-auto px-2.5">
            <p className="px-2.5 pb-2 text-[10.5px] font-semibold tracking-wide text-white/45">
              SITES
            </p>
            <div className="flex flex-col gap-0.5">
              {coverage.sites.map((s) => (
                <Link
                  key={s.site.id}
                  href={`/dashboard?site=${s.site.id}`}
                  className="flex items-center gap-2 rounded-brand px-2.5 py-1.5 text-[12.5px] text-white/80 hover:bg-white/10"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[s.status]}`} />
                  <span className="truncate">{s.site.name}</span>
                  <span className="ml-auto text-[11px] text-white/45">{s.photoCount}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto px-4 pt-4 text-[11.5px] leading-relaxed text-white/55">
          <p className="truncate">{user.email}</p>
          <p className="mt-1 inline-block rounded-brand bg-white/15 px-2 py-0.5 text-[10.5px] font-bold text-white">
            {ROLE_LABELS[user.role]}
          </p>
          <form action={logoutAction}>
            <button type="submit" className="mt-1.5 block text-brand-light hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex items-center justify-between px-4 py-3.5 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark className="h-[22px] w-[22px]" />
          <span className="text-sm font-extrabold tracking-wide text-white">DOUGH SPOT</span>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Sign out"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-brand bg-white/15 text-[11px] font-bold text-white"
          >
            {initialsFor(user.email)}
          </button>
        </form>
      </div>
    </header>
  );
}
