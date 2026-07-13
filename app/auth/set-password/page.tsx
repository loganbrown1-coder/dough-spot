import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SetPasswordForm from "@/app/components/SetPasswordForm";

export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-brand border border-border-default border-t-[3px] border-t-navy bg-white p-9">
          <div className="mb-5 flex flex-col gap-1.5">
            <h1 className="text-lg font-extrabold text-navy">Set your password</h1>
            <p className="text-[13px] text-secondary">For {user.email}</p>
          </div>
          <SetPasswordForm />
        </div>
      </div>
    </div>
  );
}
