import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/app/components/LoginForm";
import LogoMark from "@/app/components/LogoMark";

const ERROR_MESSAGES: Record<string, string> = {
  invite_link_invalid:
    "That link has expired or was already used. Request a new one and try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

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

          {errorMessage && (
            <p className="mt-6 rounded-brand border border-error-border bg-error-bg px-3 py-2.5 text-[13px] text-error">
              {errorMessage}
            </p>
          )}

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
