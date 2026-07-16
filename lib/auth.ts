import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  name: string;
  role: string;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? null,
    name: data?.name ?? user.email?.split("@")[0] ?? "User",
    role: data?.role ?? "Staff",
  };
}

// Effective (display) role — Administrators can preview another role via a cookie.
// The REAL role still governs all permissions; this only changes what's shown.
export async function getViewRole(): Promise<{ real: string; effective: string; preview: string | null }> {
  const me = await getProfile();
  const real = me?.role ?? "Staff";
  let preview: string | null = null;
  if (real === "Administrator") {
    const c = cookies().get("preview_role")?.value;
    if (c) preview = c;
  }
  return { real, effective: preview ?? real, preview };
}
