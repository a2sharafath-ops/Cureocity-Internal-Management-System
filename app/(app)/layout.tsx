import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
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

  const name = profile?.name ?? user.email?.split("@")[0] ?? "User";
  const role = profile?.role ?? "Staff";
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar role={role} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            height: 56, background: "var(--card)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", padding: "0 24px", position: "sticky", top: 0, zIndex: 10,
          }}
        >
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            Cureocity — Internal Management System
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
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
