import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SetPasswordForm from "@/app/components/SetPasswordForm";

export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Set your password</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Signed in as {user.email}. Choose a password to finish setting up your
            account.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <SetPasswordForm />
        </div>
      </div>
    </div>
  );
}
