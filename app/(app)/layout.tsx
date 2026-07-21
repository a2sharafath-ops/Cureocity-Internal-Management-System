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
      <Sidebar role={role} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Floating glass header.
            The outer element is the sticky rail — transparent, full width, and
            it owns the top offset. The inner pill is what you see. Splitting
            them matters: a sticky element with its own margin-top jitters on
            scroll in Safari, and backdrop-filter needs a non-transparent
            stacking context to blur against.

            `backdrop-filter` is progressively enhanced — where it isn't
            supported the rgba background alone still reads as a light pill,
            just without the frost. */}
        <header
          style={{
            position: "sticky", top: 0, zIndex: 30,
            padding: "14px 24px 6px", pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              minHeight: 52, padding: "7px 10px 7px 20px",
              pointerEvents: "auto",
              borderRadius: 999,
              background: "rgba(255,255,255,0.72)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              backdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 1px 2px rgba(20,20,25,0.04), 0 8px 28px rgba(20,20,25,0.08)",
            }}
          >
          <HeaderTitle />
          <span style={{ flex: 1 }} />
          <Link href="/messages" title="Communications" style={{ border: "1px solid rgba(20,20,25,0.07)", background: "rgba(255,255,255,0.55)", borderRadius: 999, width: 34, height: 34, display: "grid", placeItems: "center", textDecoration: "none", fontSize: 15, marginRight: 2 }}>💬</Link>
          <NotificationBell items={notifs} unread={unread} />
          {(real === "Administrator" || real === "Super Admin") && <RolePreview preview={preview} profession={profession} />}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, marginLeft: 12 }}>
            <Link href="/account" title="My account" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12 }}>
                {initials}
              </span>
              <b style={{ fontSize: 13 }}>{name}</b>
              <span style={{ color: "var(--muted)" }}>· {role}</span>
            </Link>
            <form action={signOut} style={{ marginLeft: 8 }}>
              <button
                type="submit"
                style={{ border: "1px solid rgba(20,20,25,0.07)", background: "rgba(255,255,255,0.55)", borderRadius: 999, padding: "6px 13px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}
              >
                Sign out
              </button>
            </form>
          </span>
          </div>
        </header>
        {/* Pulled up under the floating header — the pill casts its blur over
            the top of the content rather than sitting on a reserved strip. */}
        <main style={{ padding: "10px 24px 24px" }}>{children}</main>
      </div>
    </div>
  );
}
