import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  // Staff don't use the portal
  if (profile && profile.role !== "Client") redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ background: "var(--sidebar)", color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", color: "var(--sidebar)", display: "grid", placeItems: "center", fontWeight: 800 }}>✚</div>
        <b>Cureocity</b>
        <span style={{ opacity: 0.7, fontSize: 13 }}>· My Portal</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, opacity: 0.9 }}>{profile?.name}</span>
        <form action={signOut}>
          <button type="submit" style={{ border: "1px solid rgba(255,255,255,.25)", background: "transparent", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>
            Sign out
          </button>
        </form>
      </header>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px" }}>{children}</main>
    </div>
  );
}
