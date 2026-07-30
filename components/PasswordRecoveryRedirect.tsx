"use client";

// Supabase fires a PASSWORD_RECOVERY auth event on the client when a recovery
// email link is opened. Without handling it, the recovery session just lands the
// user on the dashboard with no way to set a new password. This listener catches
// that event anywhere in the app and sends them to the reset-password screen.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PasswordRecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && pathname !== "/reset-password") {
        router.replace("/reset-password");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, pathname]);

  return null;
}
