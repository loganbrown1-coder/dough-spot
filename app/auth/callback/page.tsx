import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase-server";
import AuthCallbackClient from "@/app/components/AuthCallbackClient";

/**
 * Landing point for Supabase Auth invite/recovery emails. Admin-triggered
 * invites (admin.auth.admin.inviteUserByEmail, see lib/actions/admin.ts)
 * always land here with the session tokens in the URL's #fragment rather
 * than a ?code= query param - there's no user-initiated PKCE handshake to
 * exchange a code against, since the recipient's browser never requested
 * anything. Fragments never reach the server, so that case is handed off
 * to AuthCallbackClient to read client-side. The ?code= branch below stays
 * as a fallback for any flow that does use PKCE (e.g. a magic link
 * initiated from a browser via signInWithOtp).
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect("/auth/set-password");
    redirect("/login?error=invite_link_invalid");
  }

  return <AuthCallbackClient />;
}
