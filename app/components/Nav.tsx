import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { canManageCaptures } from "@/lib/auth";
import LogoMark from "@/app/components/LogoMark";
import NavLinks from "@/app/components/NavLinks";
import { ROLE_LABELS } from "@/lib/roleLabels";
import type { Profile } from "@/types";

function initialsFor(email: string): string {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export default function Nav({ user }: { user: Profile | null }) {
  if (!user) return null;

  const showAdmin = user.role === "super_admin";
  const showUpload = canManageCaptures(user.role);

  return (
    <header className="bg-navy">
      {/* Desktop */}
      <div className="mx-auto hidden max-w-6xl items-center justify-between px-8 py-2.5 lg:flex">
        <div className="flex items-center gap-9">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <LogoMark className="h-[26px] w-[26px]" />
            <span className="flex flex-col leading-none">
              <span className="text-base font-extrabold tracking-wide text-white">
                DOUGH SPOT
              </span>
              <span className="text-[10px] font-semibold text-white/50">
                Powered by OpSpot
              </span>
            </span>
          </Link>
          <NavLinks showUpload={showUpload} showAdmin={showAdmin} />
        </div>
        <div className="flex items-center gap-3.5 text-sm">
          <span className="font-semibold text-white">{user.email}</span>
          <span className="rounded-brand bg-white/15 px-2.5 py-1 text-xs font-bold text-white">
            {ROLE_LABELS[user.role]}
          </span>
          <span className="text-white/40">|</span>
          <form action={logoutAction}>
            <button type="submit" className="font-semibold text-white/80 hover:text-white">
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
