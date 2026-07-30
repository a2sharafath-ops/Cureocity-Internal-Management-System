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
    if (pathname === "/reset-password") return;
    // 1) URL marker check — the recovery redirect carries `type=recovery` in the
    //    hash (implicit) or query (?code=... with recovery). This catches the
    //    case where the auth event already fired before this mounted.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const search = typeof window !== "undefined" ? window.location.search : "";
    if (/type=recovery/.test(hash) || /type=recovery/.test(search)) {
      router.replace(`/reset-password${hash || search}`);
      return;
    }
    // 2) Event fallback for anything that arrives just after mount.
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") router.replace("/reset-password");
    });
    return () => sub.subscription.unsubscribe();
  }, [router, pathname]);

  return null;
}
