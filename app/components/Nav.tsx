import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";

export default async function Nav() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-bold text-neutral-900">
            Cut Cam
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-600">
            <Link href="/dashboard" className="hover:text-neutral-900">
              Dashboard
            </Link>
            <Link href="/upload" className="hover:text-neutral-900">
              Upload
            </Link>
            {(user.role === "org_admin" || user.role === "super_admin") && (
              <Link href="/admin" className="hover:text-neutral-900">
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>
            {user.email} <span className="text-neutral-400">({user.role})</span>
          </span>
          <form action={logoutAction}>
            <button type="submit" className="text-orange-600 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
