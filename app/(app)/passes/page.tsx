import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { usePass } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MetricCard from "@/components/MetricCard";
import PassSell from "@/components/PassSell";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default async function PassesPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/passes")) redirect("/dashboard");

  const supabase = createClient();
  const [clientsR, passTypesR, passesR] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("pass_types").select("id, name, price, entries, valid_days").eq("active", true).order("price"),
    supabase.from("passes").select("id, name, guest_name, entries_total, entries_used, valid_until, status, price, created_at, clients(id, name)").order("created_at", { ascending: false }).limit(60),
  ]);

  const clients = (clientsR.data ?? []) as { id: string; name: string }[];
  const passTypes = (passTypesR.data ?? []) as { id: string; name: string; price: number; entries: number; valid_days: number }[];
  const passes = (passesR.data ?? []) as unknown as { id: string; name: string | null; guest_name: string | null; entries_total: number; entries_used: number; valid_until: string | null; status: string; price: number; created_at: string; clients: { id: string; name: string } | null }[];

  const today = todayISO();
  const activePasses = passes.filter((p) => p.status === "active").length;
  const soldToday = passes.filter((p) => (p.created_at ?? "").slice(0, 10) === today);
  const revToday = soldToday.reduce((s, p) => s + Number(p.price), 0);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px" };
  const stat = (label: string, value: string) => <MetricCard label={label} value={value} color="var(--brand-text)" />;

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["passes"]} />
      <Link href="/dashboard" style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 10 }}>← Dashboard</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Gym Passes</h1>
        <span style={{ flex: 1 }} />
        <PassSell passTypes={passTypes} clients={clients} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 18px" }}>Day passes &amp; punch cards for members and walk-ins. Each sale posts a paid invoice into Billing.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        {stat("Active passes", String(activePasses))}
        {stat("Sold today", String(soldToday.length))}
        {stat("Pass revenue today", money(revToday))}
      </div>

      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={th}>Pass</th><th style={th}>Holder</th><th style={th}>Entries</th><th style={th}>Valid until</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {passes.map((p) => {
              const expired = p.status === "active" && p.valid_until && p.valid_until < today;
              const status = expired ? "expired" : p.status;
              const chip = status === "active" ? ["var(--green-bg)", "var(--green-text)"] : status === "used" ? ["var(--neutral-bg)", "var(--muted)"] : ["var(--red-bg)", "var(--red)"];
              return (
                <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name ?? "Pass"}</td>
                  <td style={td}>{p.clients ? <Link href={`/clients/${p.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none" }}>{p.clients.name}</Link> : (p.guest_name ?? "Guest")}</td>
                  <td style={td}>{p.entries_used}/{p.entries_total >= 999 ? "∞" : p.entries_total}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{p.valid_until ?? "—"}</td>
                  <td style={td}><span style={{ background: chip[0], color: chip[1], borderRadius: 999, padding: "2px 10px", fontWeight: 600, fontSize: 12 }}>{status}</span></td>
                  <td style={td}>
                    {status === "active" && (
                      <form action={usePass} style={{ textAlign: "right" }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" style={{ border: "1px solid var(--brand-fill)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Check in</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {passes.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No passes sold yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
