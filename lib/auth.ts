import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  name: string;
  role: string;
  /** home branch — used to scope things like the daily whiteboard */
  branch: string | null;
  /** staff.id behind this login; null for client-portal users */
  staffId: string | null;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("name, role, branch, staff_id")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? null,
    name: data?.name ?? user.email?.split("@")[0] ?? "User",
    role: data?.role ?? "Staff",
    branch: data?.branch ?? null,
    // The staff row behind this login. Null for client portal users, and for
    // any staff profile that was never linked. Lead ownership falls back to
    // this when no owner is chosen explicitly.
    staffId: (data as { staff_id?: string | null } | null)?.staff_id ?? null,
  };
}

// Effective (display) role — Administrators can preview another role via a cookie.
// The REAL role still governs all permissions; this only changes what's shown.
export async function getViewRole(): Promise<{ real: string; effective: string; preview: string | null; profession: string | null }> {
  const me = await getProfile();
  const real = me?.role ?? "Staff";
  let preview: string | null = null;
  let profession: string | null = null;
  if (real === "Administrator" || real === "Super Admin") {
    const c = cookies().get("preview_role")?.value;
    if (c) preview = c;
    const p = cookies().get("preview_profession")?.value;
    if (p) profession = p;
  }
  return { real, effective: preview ?? real, preview, profession };
}
