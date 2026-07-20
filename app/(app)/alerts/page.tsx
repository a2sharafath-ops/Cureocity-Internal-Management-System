import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { openNotification, markAllNotificationsRead } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

function ago(iso: string) {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function AlertsPage() {
  const me = await getProfile();
  if (!me) redirect("/dashboard");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("notifications").select("id, title, body, href, icon, read, created_at")
    .eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(200);
  const items = (data ?? []) as { id: string; title: string; body: string | null; href: string | null; icon: string | null; read: boolean; created_at: string }[];
  const unread = items.filter((n) => !n.read).length;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

  return (
    <div style={{ maxWidth: 780 }}>
      <RealtimeRefresh tables={["notifications"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Notifications</h1>
        <span style={{ flex: 1 }} />
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)" }}>Mark all read</button>
          </form>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Your in-app alerts · {unread} unread of {items.length}.</p>

      <div style={{ ...box, overflow: "hidden" }}>
        {items.length === 0 && <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>You&apos;re all caught up. 🎉</div>}
        {items.map((n) => (
          <form key={n.id} action={openNotification}>
            <input type="hidden" name="id" value={n.id} />
            <input type="hidden" name="href" value={n.href ?? ""} />
            <button type="submit" style={{ display: "flex", gap: 12, width: "100%", textAlign: "left", border: "none", borderTop: "1px solid var(--border)", padding: "12px 16px", cursor: "pointer", background: n.read ? "transparent" : "rgba(13,148,136,0.06)" }}>
              <div style={{ fontSize: 18 }}>{n.icon ?? "🔔"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 13, color: "var(--muted)" }}>{n.body}</div>}
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{ago(n.created_at)}</div>
              </div>
              {!n.read && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--brand-fill)", marginTop: 6 }} />}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
