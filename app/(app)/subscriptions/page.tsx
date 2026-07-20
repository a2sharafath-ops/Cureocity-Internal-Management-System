import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canBill } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { processDueRenewals } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import SubForm from "@/components/SubForm";
import SubActions from "@/components/SubActions";

export const dynamic = "force-dynamic";

function money(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

type Sub = {
  id: string; amount: number; status: string; auto_renew: boolean; renews_on: string | null; interval_days: number;
  clients: { id: string; name: string } | null; packages: { name: string } | null;
};

export default async function SubscriptionsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/subscriptions")) redirect("/dashboard");
  const editable = canBill(me.role);

  const supabase = createClient();
  const [{ data: subData }, { data: clientData }, { data: pkgData }] = await Promise.all([
    supabase.from("subscriptions").select("id, amount, status, auto_renew, renews_on, interval_days, clients(id, name), packages(name)").order("renews_on"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("packages").select("id, name").eq("active", true).order("id"),
  ]);
  const subs = (subData ?? []) as unknown as Sub[];
  const clients = (clientData ?? []) as { id: string; name: string }[];
  const packages = (pkgData ?? []) as { id: string; name: string }[];

  const today = todayISO();
  const active = subs.filter((s) => s.status === "active");
  const mrr = active.reduce((sum, s) => sum + Number(s.amount) * (30 / (s.interval_days || 30)), 0);
  const dueCount = active.filter((s) => s.auto_renew && (s.renews_on ?? "") <= today).length;

  const statusChip = (s: string) => {
    const map: Record<string, [string, string]> = { active: ["var(--green-bg)", "var(--green-text)"], paused: ["var(--amber-bg)", "var(--amber-text)"], cancelled: ["var(--neutral-bg)", "var(--muted)"] };
    const [bg, color] = map[s] ?? ["var(--neutral-bg)", "var(--muted)"];
    return <span style={{ background: bg, color, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{s}</span>;
  };

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["subscriptions", "invoices"]} />
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4, gap: 10 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Subscriptions</h1>
        <span style={{ flex: 1 }} />
        {editable && dueCount > 0 && (
          <form action={processDueRenewals}>
            <button type="submit" style={{ background: "var(--amber)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Process {dueCount} due renewal{dueCount === 1 ? "" : "s"}
            </button>
          </form>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>
        Recurring plans · {active.length} active · est. MRR {money(mrr)} · {dueCount} due for renewal
      </p>

      {editable && <SubForm clients={clients} packages={packages} />}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
              <th style={{ padding: "12px 16px" }}>Client</th>
              <th style={{ padding: "12px 16px" }}>Plan</th>
              <th style={{ padding: "12px 16px" }}>Amount</th>
              <th style={{ padding: "12px 16px" }}>Renews</th>
              <th style={{ padding: "12px 16px" }}>Status</th>
              {editable && <th style={{ padding: "12px 16px" }} />}
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const due = s.status === "active" && (s.renews_on ?? "") <= today;
              return (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    {s.clients ? <Link href={`/clients/${s.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{s.clients.name}</Link> : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{s.packages?.name ?? "—"}<div style={{ color: "var(--muted)", fontSize: 11 }}>every {s.interval_days} days</div></td>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{money(s.amount)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {s.renews_on ?? "—"} {due && <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>due</span>}
                    {!s.auto_renew && s.status === "active" && <div style={{ color: "var(--muted)", fontSize: 11 }}>auto-renew off</div>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{statusChip(s.status)}</td>
                  {editable && <td style={{ padding: "12px 16px" }}><SubActions id={s.id} status={s.status} autoRenew={s.auto_renew} /></td>}
                </tr>
              );
            })}
            {subs.length === 0 && (
              <tr><td colSpan={editable ? 6 : 5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>No subscriptions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
        Auto-renew generates an unpaid invoice on the renewal date. A daily Vercel Cron (3:00 UTC) processes these automatically once <code>CRON_SECRET</code> is set in your environment — the button above runs them on demand meanwhile.
      </div>
    </div>
  );
}
