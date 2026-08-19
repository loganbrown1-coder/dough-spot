"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarLinks({
  showUpload,
  showAdmin,
  openFlagCount,
}: {
  showUpload: boolean;
  showAdmin: boolean;
  /** undefined when the caller can't see Flags at all (showUpload false), same gate as the link itself. */
  openFlagCount?: number;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    ...(showUpload ? [{ href: "/upload", label: "Upload" }] : []),
    ...(showUpload ? [{ href: "/flags", label: "Flags", badge: openFlagCount }] : []),
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="flex flex-col gap-0.5 px-2.5">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center rounded-brand px-3 py-2.5 text-[13px] font-medium ${
              active ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/8 hover:text-white"
            }`}
          >
            {link.label}
            {"badge" in link && Boolean(link.badge) && (
              <span className="ml-auto rounded-full bg-error px-1.5 py-0.5 text-[10px] font-bold text-white">
                {link.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
