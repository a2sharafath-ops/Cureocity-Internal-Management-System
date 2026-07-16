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
