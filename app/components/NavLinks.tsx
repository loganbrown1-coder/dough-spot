"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({
  showUpload,
  showAdmin,
}: {
  showUpload: boolean;
  showAdmin: boolean;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    ...(showUpload ? [{ href: "/upload", label: "Upload" }] : []),
    ...(showUpload ? [{ href: "/flags", label: "Flags" }] : []),
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="flex items-center gap-7 text-sm font-semibold">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "border-b-2 border-brand-light pb-1 text-white"
                : "border-b-2 border-transparent pb-1 text-white/65 hover:text-white"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
