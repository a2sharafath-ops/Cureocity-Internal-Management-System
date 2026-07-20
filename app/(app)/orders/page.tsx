import Link from "next/link";
import BackLink from "@/components/BackLink";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { OrderActions } from "@/components/OrderActions";
import SegTabs from "@/components/SegTabs";

export const dynamic = "force-dynamic";

export default async function OrdersWorklistPage({ searchParams }: { searchParams: { view?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/orders")) redirect("/dashboard");

  const view = searchParams.view === "all" ? "all" : "open";
  const supabase = createClient();
  let query = supabase.from("orders").select("id, category, test, priority, status, result, result_date, created_at, client_id, clients(id, name)").order("created_at", { ascending: false }).limit(200);
  if (view === "open") query = query.in("status", ["ordered", "collected"]);
  const { data } = await query;
  const orders = (data ?? []) as unknown as { id: string; category: string; test: string; priority: string; status: string; result: string | null; result_date: string | null; created_at: string; client_id: string; clients: { id: string; name: string } | null }[];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const stat = (rank: string) => rank === "stat" ? { color: "var(--red)", label: "STAT" } : rank === "urgent" ? { color: "#92400e", label: "URGENT" } : null;

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["orders"]} />
      <BackLink />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Orders worklist</h1>
        <span style={{ flex: 1 }} />
        <SegTabs active={view} size="sm" items={[
          { key: "open", label: "Open", href: "/orders?view=open" },
          { key: "all", label: "All", href: "/orders?view=all" },
        ]} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Pending lab &amp; imaging orders across all patients. Collect samples, then enter results.</p>

      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Patient</th><th style={th}>Test</th><th style={th}>Type</th><th style={th}>Priority</th><th style={th}>Status</th><th style={th}>Result</th><th style={th} /></tr></thead>
          <tbody>
            {orders.map((o) => {
              const s = stat(o.priority);
              const chip = o.status === "resulted" ? ["var(--green-bg)", "#166534"] : o.status === "cancelled" ? ["#fee2e2", "var(--red)"] : o.status === "collected" ? ["var(--amber-bg)", "#92400e"] : ["#eef2f1", "var(--muted)"];
              return (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{o.clients ? <Link href={`/emr/${o.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{o.clients.name}</Link> : "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{o.test}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{o.category}</td>
                  <td style={td}>{s ? <span style={{ color: s.color, fontWeight: 700, fontSize: 12 }}>{s.label}</span> : <span style={{ color: "var(--muted)" }}>routine</span>}</td>
                  <td style={td}><span style={{ background: chip[0], color: chip[1], borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{o.status}</span></td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{o.result ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}><OrderActions id={o.id} clientId={o.client_id} status={o.status} /></td>
                </tr>
              );
            })}
            {orders.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>{view === "open" ? "No open orders. 🎉" : "No orders yet."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
