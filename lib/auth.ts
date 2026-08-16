import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveViewRole, type ViewRole } from "@/lib/role-preview";

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

// Memoized for the lifetime of a single request with React `cache()`. A page
// render resolves the profile many times — the page body, its `canSee` guards,
// `getViewRole`, and the layout all call this — and each call used to repeat
// `auth.getUser()` (a network round-trip that revalidates the JWT against
// Supabase Auth) plus a `profiles` read. `cache()` collapses all of those into
// ONE getUser + ONE profiles query per request, shared across the layout and
// page. This is a direct cut to the fixed per-navigation latency.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally where possible (network only when it
  // must), avoiding a getUser() round-trip on every request. cache() then dedupes
  // this across the layout + page of a single render.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;
  const userId = claims.sub as string;
  const email = (claims.email as string | undefined) ?? null;
  const { data } = await supabase
    .from("profiles")
    .select("name, role, branch, staff_id")
    .eq("id", userId)
    .maybeSingle();
  return {
    id: userId,
    email,
    name: data?.name ?? email?.split("@")[0] ?? "User",
    role: data?.role ?? "Staff",
    branch: data?.branch ?? null,
    // The staff row behind this login. Null for client portal users, and for
    // any staff profile that was never linked. Lead ownership falls back to
    // this when no owner is chosen explicitly.
    staffId: (data as { staff_id?: string | null } | null)?.staff_id ?? null,
  };
});

// Effective (display) role — Administrators can preview another role via a cookie.
// The REAL role still governs all permissions; this only changes what's shown.
export async function getViewRole(): Promise<ViewRole> {
  const me = await getProfile();
  const real = me?.role ?? "Staff";
  const store = await cookies();
  return resolveViewRole(
    real,
    store.get("preview_role")?.value,
    store.get("preview_profession")?.value,
  );
}
