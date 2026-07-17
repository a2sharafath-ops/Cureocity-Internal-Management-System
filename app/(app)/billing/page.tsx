import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canBill } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import InvoiceActions from "@/components/InvoiceActions";
import InvoiceForm from "@/components/InvoiceForm";
import PayOnlineButton from "@/components/PayOnlineButton";
import { paymentStatus } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

function money(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

type Inv = {
  id: string; num: number | null; description: string | null; amount: number;
  status: string; method: string | null; issued_date: string | null; paid_date: string | null;
  clients: { id: string; name: string } | null;
};

export default async function BillingPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/billing")) redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, num, description, amount, status, method, issued_date, paid_date, clients(id, name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const invoices = (data ?? []) as unknown as Inv[];
  const month = todayISO().slice(0, 7);
  const revenue = invoices.filter((i) => i.status === "Paid" && (i.paid_date ?? "").startsWith(month)).reduce((s, i) => s + Number(i.amount), 0);
  const unpaid = invoices.filter((i) => i.status === "Unpaid").reduce((s, i) => s + Number(i.amount), 0);
  const unpaidCount = invoices.filter((i) => i.status === "Unpaid").length;
  const editable = canBill(me.role);
  const pay = paymentStatus();

  const kpi = (label: string, value: string, sub?: string) => (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 16px", flex: 1, minWidth: 170 }}>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12 }}>{sub}</div>}
    </div>
  );

  const statusChip = (s: string) => {
    const map: Record<string, [string, string]> = { Paid: ["var(--green-bg)", "#166534"], Unpaid: ["var(--amber-bg)", "#92400e"], Refunded: ["#eef2f1", "var(--muted)"] };
    const [bg, color] = map[s] ?? ["#eef2f1", "var(--muted)"];
    return <span style={{ background: bg, color, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{s}</span>;
  };

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["invoices"]} />
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Billing</h1>
        <span style={{ flex: 1 }} />
        {editable && <InvoiceForm />}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 18px" }}>Invoices &amp; payments · {invoices.length} invoice{invoices.length === 1 ? "" : "s"}</p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        {kpi("Revenue this month", money(revenue), "paid invoices")}
        {kpi("Outstanding", money(unpaid), `${unpaidCount} unpaid`)}
        {kpi("Total invoices", String(invoices.length))}
      </div>

      {editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: pay.configured ? "var(--green-bg)" : "#eef2f1", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 18, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Online payments:</span>
          {pay.configured
            ? <span style={{ color: "#166534" }}>● Live via {pay.provider} — unpaid invoices show a “Pay online” button.</span>
            : <span style={{ color: "var(--muted)" }}>○ Not configured. Add <code>PAYMENT_PROVIDER</code> + gateway keys in your environment to enable one-click collection (webhook: <code>/api/payments/webhook</code>).</span>}
        </div>
      )}

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load invoices.</b> {error.message}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "12px 16px" }}>#</th>
                <th style={{ padding: "12px 16px" }}>Client</th>
                <th style={{ padding: "12px 16px" }}>Description</th>
                <th style={{ padding: "12px 16px" }}>Amount</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                {editable && <th style={{ padding: "12px 16px" }} />}
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>INV-{String(i.num ?? 0).padStart(3, "0")}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {i.clients ? <Link href={`/clients/${i.clients.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 600 }}>{i.clients.name}</Link> : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{i.description}<div style={{ color: "var(--muted)", fontSize: 11 }}>{i.issued_date ?? ""}{i.method ? ` · ${i.method}` : ""}</div></td>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{money(i.amount)}</td>
                  <td style={{ padding: "12px 16px" }}>{statusChip(i.status)}</td>
                  {editable && <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                      {i.status === "Unpaid" && <PayOnlineButton invoiceId={i.id} configured={pay.configured} />}
                      <InvoiceActions id={i.id} status={i.status} />
                    </div>
                  </td>}
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={editable ? 6 : 5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
