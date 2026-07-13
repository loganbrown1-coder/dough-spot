import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/app/components/LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Dough Spot</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sign in to view or upload site photos
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-500">
          <p className="mb-1 font-medium text-neutral-600">Test accounts (POC)</p>
          <p>manager@fireaway.test - site manager</p>
          <p>ops@fireaway.test - ops</p>
          <p>admin@fireaway.test - org admin</p>
          <p>super@opspot.test - super admin (all organisations)</p>
          <p>admin@wildfiregrill.test - org admin, separate organisation</p>
          <p className="mt-1">password: Password123!</p>
        </div>
      </div>
    </div>
  );
}
