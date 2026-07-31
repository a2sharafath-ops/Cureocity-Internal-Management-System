import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canManageInvoices, canRecordPayment } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MetricCard from "@/components/MetricCard";
import { monthTrend, prevMonthKey, sumInMonth } from "@/lib/trend";
import type { MetricKey } from "@/lib/metric-directions";
import InvoiceActions from "@/components/InvoiceActions";
import InvoiceForm from "@/components/InvoiceForm";
import PayOnlineButton from "@/components/PayOnlineButton";
import { paymentStatus } from "@/lib/payments/config";
import { raiseInvoiceForClient } from "@/lib/actions";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

function money(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
}

type Inv = {
  id: string; num: number | null; description: string | null; amount: number;
  status: string; method: string | null; issued_date: string | null; paid_date: string | null;
  clients: { id: string; name: string } | null;
};

const TABS = [
  { key: "invoices", label: "Invoices" },
  { key: "subscriptions", label: "Subscriptions", href: "/subscriptions" },
  { key: "unbilled", label: "Unbilled packages" },
  { key: "refunds", label: "Refunds & credits" },
  { key: "dunning", label: "Dunning" },
];

export default async function BillingPage({ searchParams }: { searchParams: { tab?: string; status?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/billing")) redirect("/dashboard");
  const tab = ["invoices", "refunds", "dunning", "unbilled"].includes(searchParams.tab ?? "") ? searchParams.tab! : "invoices";
  // Deep-link from the dashboard Money cards: /billing?status=paid|unpaid filters
  // the invoices list to that status.
  const statusFilter = ["paid", "unpaid", "refunded"].includes((searchParams.status ?? "").toLowerCase()) ? (searchParams.status!.toLowerCase()) : null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, num, description, amount, status, method, issued_date, paid_date, clients(id, name)")
    .order("created_at", { ascending: false })
    .limit(300);

  const invoices = (data ?? []) as unknown as Inv[];
  const today = todayISO();
  const month = today.slice(0, 7);
  const revenue = invoices.filter((i) => i.status === "Paid" && (i.paid_date ?? "").startsWith(month)).reduce((s, i) => s + Number(i.amount), 0);
  const unpaidInv = invoices.filter((i) => i.status === "Unpaid");
  const unpaid = unpaidInv.reduce((s, i) => s + Number(i.amount), 0);
  const refunded = invoices.filter((i) => i.status === "Refunded");
  const editable = canManageInvoices(me.role);
  // The per-row action column also serves collectors (Front Desk) who only mark
  // invoices paid — they can't raise/void invoices, so `editable` stays separate.
  const canAct = editable || canRecordPayment(me.role);
  const pay = paymentStatus();

  // dunning = unpaid, aged oldest-first
  const dunning = [...unpaidInv].sort((a, b) => (a.issued_date ?? "").localeCompare(b.issued_date ?? ""));
  const overdue = dunning.filter((i) => i.issued_date && daysBetween(today, i.issued_date) >= 1);
  const bucket = (lo: number, hi: number) => overdue.filter((i) => { const d = daysBetween(today, i.issued_date!); return d >= lo && (hi === Infinity ? true : d <= hi); }).length;

  // The invoice select carries issued_date and paid_date already, so last
  // month is a filter rather than a query. Capped at 300 rows though — on a
  // busy month the comparison window could be truncated, which is why the
  // helper omits the trend entirely rather than guessing when prior is 0.
  const lastMonth = prevMonthKey(month);
  const revenuePrev = sumInMonth(invoices.filter((i) => i.status === "Paid"), lastMonth, (i) => i.paid_date, (i) => Number(i.amount));
  const unpaidPrev = sumInMonth(unpaidInv, lastMonth, (i) => i.issued_date, (i) => Number(i.amount));
  const overduePrev = sumInMonth(overdue, lastMonth, (i) => i.issued_date, (i) => Number(i.amount));
  const refundedPrev = sumInMonth(refunded, lastMonth, (i) => i.issued_date, (i) => Number(i.amount));

  // Invoices tab, optionally filtered by status (from the dashboard cards).
  const shownInvoices = statusFilter ? invoices.filter((i) => i.status.toLowerCase() === statusFilter) : invoices;

  // Unbilled = clients on a priced package with no invoice raised — the revenue
  // leak. Front desk / finance can raise the invoice straight from the row.
  let unbilled: { id: string; name: string; pkg: string; price: number }[] = [];
  if (tab === "unbilled") {
    const [{ data: cl }, { data: pk }, { data: invClients }] = await Promise.all([
      supabase.from("clients").select("id, name, package_id"),
      supabase.from("packages").select("id, name, price, is_facility"),
      supabase.from("invoices").select("client_id"),
    ]);
    const pkgMap = new Map(((pk ?? []) as { id: string; name: string; price: number }[]).map((p) => [p.id, p]));
    const invSet = new Set(((invClients ?? []) as { client_id: string | null }[]).map((r) => r.client_id).filter(Boolean));
    unbilled = ((cl ?? []) as { id: string; name: string; package_id: string | null }[])
      .map((c) => ({ c, p: c.package_id ? pkgMap.get(c.package_id) : null }))
      .filter((x): x is { c: { id: string; name: string; package_id: string | null }; p: { id: string; name: string; price: number } } => Boolean(x.p && Number(x.p.price) > 0 && !invSet.has(x.c.id)))
      .map(({ c, p }) => ({ id: c.id, name: c.name, pkg: p.name, price: Number(p.price) }));
  }

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const kpi = (label: string, value: string, sub?: string, now?: number, prev?: number, metric: MetricKey = "revenue_month") => (
    <MetricCard label={label} value={value} sub={sub} minWidth={170}
      trend={now == null ? undefined : monthTrend(now, prev, metric)} />
  );
  const statusChip = (s: string) => {
    const map: Record<string, [string, string]> = { Paid: ["var(--green-bg)", "var(--green-text)"], Unpaid: ["var(--amber-bg)", "var(--amber-text)"], Refunded: ["var(--neutral-bg)", "var(--muted)"] };
    const [bg, color] = map[s] ?? ["var(--neutral-bg)", "var(--muted)"];
    return <span style={{ background: bg, color, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{s}</span>;
  };
  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14 };

  const rowsFor = (list: Inv[], mode: "default" | "dunning") => (
    <div style={{ ...box, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>#</th><th style={th}>Client</th><th style={th}>Description</th>
            {mode === "dunning" && <th style={th}>Overdue</th>}
            <th style={th}>Amount</th><th style={th}>Status</th>{canAct && <th style={th} />}
          </tr>
        </thead>
        <tbody>
          {list.map((i) => {
            const od = i.issued_date ? daysBetween(today, i.issued_date) : 0;
            return (
              <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, color: "var(--muted)" }}>INV-{String(i.num ?? 0).padStart(3, "0")}</td>
                <td style={td}>{i.clients ? <Link href={`/clients/${i.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{i.clients.name}</Link> : "—"}</td>
                <td style={td}>{i.description}<div style={{ color: "var(--muted)", fontSize: 11 }}>{i.issued_date ?? ""}{i.method ? ` · ${i.method}` : ""}</div></td>
                {mode === "dunning" && <td style={{ ...td, fontWeight: 600, color: od >= 30 ? "var(--red)" : od >= 15 ? "var(--amber-text-soft)" : "var(--muted)" }}>{od > 0 ? `${od}d` : "—"}</td>}
                <td style={{ ...td, fontWeight: 600 }}>{money(i.amount)}</td>
                <td style={td}>{statusChip(i.status)}</td>
                {canAct && <td style={{ ...td, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                    {i.status === "Unpaid" && <PayOnlineButton invoiceId={i.id} configured={pay.configured} />}
                    <InvoiceActions id={i.id} status={i.status} role={me.role} canRefund={editable} clientId={i.clients?.id} label={`INV-${String(i.num ?? 0).padStart(3, "0")} · ${money(i.amount)}`} />
                  </div>
                </td>}
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={canAct ? (mode === "dunning" ? 7 : 6) : (mode === "dunning" ? 6 : 5)} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 16px" }}>Nothing here.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["invoices"]} />
      <div style={{ marginBottom: 10 }}><BackButton /></div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Billing</h1>
        <span style={{ flex: 1 }} />
        {editable && <InvoiceForm />}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Invoices · subscriptions &amp; renewals · refunds &amp; credits · dunning</p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        {kpi("Revenue this month", money(revenue), `${invoices.filter((i) => i.status === "Paid" && (i.paid_date ?? "").startsWith(month)).length} paid invoices`, revenue, revenuePrev, "revenue_month")}
        {kpi("Outstanding", money(unpaid), `${unpaidInv.length} unpaid`, unpaid, unpaidPrev, "outstanding")}
        {kpi("Overdue", money(overdue.reduce((s, i) => s + Number(i.amount), 0)), `${overdue.length} invoices`, overdue.reduce((s, i) => s + Number(i.amount), 0), overduePrev, "overdue")}
        {kpi("Refunded", money(refunded.reduce((s, i) => s + Number(i.amount), 0)), `${refunded.length} total`, refunded.reduce((s, i) => s + Number(i.amount), 0), refundedPrev, "refunded")}
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((t) => {
          const active = t.href ? false : tab === t.key;
          const href = t.href ?? `/billing?tab=${t.key}`;
          return <Link key={t.key} href={href} style={{ padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)", background: active ? "var(--brand-fill)" : "#fff", color: active ? "#fff" : "var(--muted)" }}>{t.label}</Link>;
        })}
      </div>

      {editable && tab === "invoices" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: pay.configured ? "var(--green-bg)" : "var(--neutral-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Online payments:</span>
          {pay.configured
            ? <span style={{ color: "var(--green-text)" }}>● Live via {pay.provider} — unpaid invoices show a “Pay online” button.</span>
            : <span style={{ color: "var(--muted)" }}>○ Not configured. Add <code>PAYMENT_PROVIDER</code> + gateway keys to enable one-click collection (webhook: <code>/api/payments/webhook</code>).</span>}
        </div>
      )}

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load invoices.</b> {error.message}
        </div>
      ) : tab === "unbilled" ? (
        <div style={{ ...box, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>Clients on a paid package with no invoice raised — {unbilled.length} · {money(unbilled.reduce((s, u) => s + u.price, 0))} not yet billed.</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Client</th><th style={th}>Package</th><th style={th}>Price</th>{editable && <th style={th} />}</tr></thead>
            <tbody>
              {unbilled.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}><Link href={`/clients/${u.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{u.name}</Link></td>
                  <td style={td}>{u.pkg}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{money(u.price)}</td>
                  {editable && <td style={{ ...td, textAlign: "right" }}>
                    <form action={raiseInvoiceForClient}>
                      <input type="hidden" name="client_id" value={u.id} />
                      <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)" }}>Raise invoice</button>
                    </form>
                  </td>}
                </tr>
              ))}
              {unbilled.length === 0 && <tr><td colSpan={editable ? 4 : 3} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 16px" }}>Nothing unbilled</td></tr>}
            </tbody>
          </table>
        </div>
      ) : tab === "refunds" ? (
        rowsFor(refunded, "default")
      ) : tab === "dunning" ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, fontSize: 12, color: "var(--muted)" }}>
            <span>Aging:</span>
            <span>1–7d <b>{bucket(1, 7)}</b></span>
            <span>8–14d <b>{bucket(8, 14)}</b></span>
            <span>15–30d <b>{bucket(15, 30)}</b></span>
            <span style={{ color: "var(--red)" }}>30d+ <b>{bucket(31, Infinity)}</b></span>
          </div>
          {rowsFor(dunning, "dunning")}
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {([["", "All"], ["paid", "Paid"], ["unpaid", "Unpaid"], ["refunded", "Refunded"]] as const).map(([k, label]) => {
              const active = (statusFilter ?? "") === k;
              return <Link key={k || "all"} href={k ? `/billing?status=${k}` : "/billing"} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)", background: active ? "var(--brand-fill)" : "#fff", color: active ? "#fff" : "var(--muted)" }}>{label}</Link>;
            })}
          </div>
          {rowsFor(shownInvoices, "default")}
        </>
      )}
    </div>
  );
}
