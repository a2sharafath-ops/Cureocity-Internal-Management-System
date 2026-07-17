import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import RolePreview from "@/components/RolePreview";
import HeaderTitle from "@/components/HeaderTitle";
import NotificationBell from "@/components/NotificationBell";
import { createClient } from "@/lib/supabase/server";
import { getViewRole } from "@/lib/auth";
import { signOut } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .maybeSingle();

  // clients don't use the staff app
  if (profile?.role === "Client") redirect("/portal");

  const { real, effective, preview, profession } = await getViewRole();

  const { data: notifRows } = await supabase
    .from("notifications").select("id, title, body, href, icon, read, created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
  const notifs = (notifRows ?? []) as { id: string; title: string; body: string | null; href: string | null; icon: string | null; read: boolean; created_at: string }[];
  const unread = notifs.filter((n) => !n.read).length;
  const name = profile?.name ?? user.email?.split("@")[0] ?? "User";
  const role = effective; // display + nav follow the (possibly previewed) role
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar role={role} canPersona={real === "Administrator"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            minHeight: 56, background: "var(--card)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", padding: "8px 24px", position: "sticky", top: 0, zIndex: 10,
          }}
        >
          <HeaderTitle />
          <span style={{ flex: 1 }} />
          <NotificationBell items={notifs} unread={unread} />
          {real === "Administrator" && <RolePreview preview={preview} profession={profession} />}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, marginLeft: 12 }}>
            <Link href="/account" title="My account" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--teal)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12 }}>
                {initials}
              </span>
              <b style={{ fontSize: 13 }}>{name}</b>
              <span style={{ color: "var(--muted)" }}>· {role}</span>
            </Link>
            <form action={signOut} style={{ marginLeft: 8 }}>
              <button
                type="submit"
                style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}
              >
                Sign out
              </button>
            </form>
          </span>
        </header>
        <main style={{ padding: "24px" }}>{children}</main>
      </div>
    </div>
  );
}
