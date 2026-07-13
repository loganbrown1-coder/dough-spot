import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";

/**
 * Landing point for Supabase Auth invite/recovery emails. The email link
 * points here with a `code` param; exchanging it establishes a session
 * (via cookies), and we send the user straight on to set a password since
 * a fresh invite/recovery session never already has one it makes sense to
 * keep.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invite_link_invalid`);
}
