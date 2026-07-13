"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/types";

export default function MobileTabBar({ user }: { user: Profile | null }) {
  const pathname = usePathname();
  if (!user) return null;

  const showAdmin = user.role === "org_admin" || user.role === "super_admin";
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/upload", label: "Upload" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border-default bg-white md:hidden">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-1 flex-col items-center gap-1 py-2.5"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${active ? "bg-navy" : "bg-border-default"}`}
            />
            <span
              className={`text-[11px] font-semibold ${active ? "text-navy" : "text-muted"}`}
            >
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
