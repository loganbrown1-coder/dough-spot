"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase-browser";

/**
 * Handles the invite/recovery link Supabase actually sends: the access and
 * refresh tokens live in the URL's #fragment, not a ?code= query param -
 * fragments never reach the server, so this has to run client-side. Once
 * the session is established (as a cookie, via the browser client), the
 * server-rendered pages downstream see it like any other session.
 */
export default function AuthCallbackClient() {
  const router = useRouter();
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInvalid(true);
      router.replace("/login?error=invite_link_invalid");
      return;
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setInvalid(true);
          router.replace("/login?error=invite_link_invalid");
        } else {
          router.replace("/auth/set-password");
        }
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <p className="text-sm text-secondary">
        {invalid ? "That invite link isn't valid." : "Finishing sign-in..."}
      </p>
    </div>
  );
}
