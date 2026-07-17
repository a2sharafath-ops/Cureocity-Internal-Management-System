import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function MessagesPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/messages")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: clientData }, { data: msgData }] = await Promise.all([
    supabase.from("clients").select("id, name, code").order("name"),
    supabase.from("messages").select("client_id, sender, body, read, created_at").order("created_at", { ascending: false }),
  ]);
  const clients = (clientData ?? []) as { id: string; name: string; code: string | null }[];
  const msgs = (msgData ?? []) as { client_id: string; sender: string; body: string; read: boolean; created_at: string }[];

  const last = new Map<string, { body: string; created_at: string; sender: string }>();
  const unread = new Map<string, number>();
  for (const m of msgs) {
    if (!last.has(m.client_id)) last.set(m.client_id, { body: m.body, created_at: m.created_at, sender: m.sender });
    if (m.sender === "client" && !m.read) unread.set(m.client_id, (unread.get(m.client_id) ?? 0) + 1);
  }

  // threads first (by latest), then clients with no messages
  const rows = [...clients].sort((a, b) => {
    const ta = last.get(a.id)?.created_at ?? "";
    const tb = last.get(b.id)?.created_at ?? "";
    return tb.localeCompare(ta);
  });

  return (
    <div style={{ maxWidth: 760 }}>
      <RealtimeRefresh tables={["messages"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Messages</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Client conversations · {clients.length} client{clients.length === 1 ? "" : "s"}</p>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
        {rows.map((c) => {
          const l = last.get(c.id);
          const u = unread.get(c.id) ?? 0;
          return (
            <Link key={c.id} href={`/messages/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)", textDecoration: "none", color: "inherit" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--teal)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>
                {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{c.name}</b>
                <div style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l ? `${l.sender === "client" ? "" : "You: "}${l.body}` : "No messages yet"}
                </div>
              </div>
              {l && <span style={{ color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{when(l.created_at)}</span>}
              {u > 0 && <span style={{ background: "var(--red)", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{u}</span>}
            </Link>
          );
        })}
        {rows.length === 0 && <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>No clients yet.</div>}
      </div>
    </div>
  );
}
