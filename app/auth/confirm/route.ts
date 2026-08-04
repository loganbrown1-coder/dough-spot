import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/supabase-server";

/**
 * Landing point for links that carry a token_hash rather than a PKCE
 * ?code= - currently just the password reset email (see forgotPasswordAction
 * and the Supabase "Reset Password" template, which must point here). A
 * code_verifier-based exchange (the ?code= flow app/auth/callback handles)
 * only works if the exact browser that requested it still holds that
 * verifier, which email links can't guarantee - the mail client's own
 * link-scanning (e.g. Outlook Safe Links) often visits the link first and
 * burns the one-time code before the real click arrives. verifyOtp has no
 * such requirement, since the token_hash is a self-contained one-time
 * secret rather than one half of a pair split across two requests.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invite_link_invalid`);
}
