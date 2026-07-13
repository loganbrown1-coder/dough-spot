import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/app/components/LoginForm";
import LogoMark from "@/app/components/LogoMark";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="rounded-brand border border-border-default border-t-[3px] border-t-navy bg-white p-10 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <LogoMark className="h-11 w-11" />
            <div>
              <h1 className="text-[22px] font-extrabold tracking-wide text-navy">
                DOUGH SPOT
              </h1>
              <p className="text-xs font-semibold text-muted">Powered by OpSpot</p>
            </div>
            <p className="text-sm leading-snug text-secondary">
              Sign in to view or upload site photos
            </p>
          </div>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <div className="rounded-brand border border-border-default bg-white p-4 text-xs text-secondary">
          <p className="mb-1 font-bold text-body">Test accounts (POC)</p>
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
