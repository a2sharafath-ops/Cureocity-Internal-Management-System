// Finance home — the money desk. Same shape as the owner and manager views
// (money, exception queue, then metrics), but every exception is a rupee that
// hasn't landed: unbilled packages, ageing invoices, failed renewals.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/today";
import MetricCard from "@/components/MetricCard";
import { monthTrend, sumInMonth } from "@/lib/trend";
import AttentionPanel, { type Flag } from "@/components/AttentionPanel";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" };
const qa: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" };

function addDays(iso: string, d: number) {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
}
/** How long an invoice has been sitting unpaid. */
function ageDays(iso: string | null, today: string) {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(iso)) / 86400000));
}

export default async function FinanceDashboard({ name }: { name: string }) {
  const supabase = createClient();
  const today = todayISO();
  const month = today.slice(0, 7);
  const lastMonth = addDays(month + "-01", -1).slice(0, 7);
  const in30 = addDays(today, 30);

  const [
    { data: invData }, { data: clientData }, { data: pkgData },
    { data: cpData }, { data: subData }, { data: expData },
  ] = await Promise.all([
    supabase.from("invoices").select("id, num, client_id, amount, status, issued_date, paid_date, description"),
    supabase.from("clients").select("id, code, name, package_id, joined"),
    supabase.from("packages").select("id, name, price, validity, is_facility"),
    supabase.from("client_packages").select("client_id, package_id, package_name, price, status, start_date, end_date"),
    supabase.from("subscriptions").select("id, client_id, status, renews_on, amount"),
    supabase.from("expenses").select("id, amount, category, date, description"),
  ]);

  const invoices = (invData ?? []) as { id: string; num: number | null; client_id: string | null; amount: number; status: string; issued_date: string | null; paid_date: string | null; description: string | null }[];
  const clients = (clientData ?? []) as { id: string; code: string | null; name: string; package_id: string | null; joined: string | null }[];
  const pkgs = new Map(((pkgData ?? []) as { id: string; name: string; price: number; validity: number; is_facility: boolean }[]).map((p) => [p.id, p]));
  const cps = (cpData ?? []) as { client_id: string; package_id: string; package_name: string | null; price: number | null; status: string; start_date: string | null; end_date: string | null }[];
  const subs = (subData ?? []) as { id: string; client_id: string | null; status: string; renews_on: string | null; amount: number | null }[];
  const expenses = (expData ?? []) as { id: string; amount: number; category: string | null; date: string | null; description: string | null }[];

  const nameOf = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  // ---- headline money ------------------------------------------------------
  const paid = invoices.filter((i) => i.status === "Paid");
  const unpaid = invoices.filter((i) => i.status !== "Paid");
  const revenueMonth = paid.filter((i) => (i.paid_date ?? "").startsWith(month)).reduce((s, i) => s + Number(i.amount), 0);
  const revenuePrev = paid.filter((i) => (i.paid_date ?? "").startsWith(lastMonth)).reduce((s, i) => s + Number(i.amount), 0);
  const billed = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const collected = paid.reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = unpaid.reduce((s, i) => s + Number(i.amount), 0);
  const collectRate = billed ? Math.round((collected / billed) * 100) : 0;
  const spendMonth = expenses.filter((e) => (e.date ?? "").startsWith(month)).reduce((s, e) => s + Number(e.amount), 0);
  const netMonth = revenueMonth - spendMonth;
  // Prior month was already fetched for every one of these — the invoices and
  // expenses selects are unfiltered — it just wasn't being used.
  const spendPrev = sumInMonth(expenses, lastMonth, (e) => e.date, (e) => Number(e.amount));
  const netPrev = revenuePrev - spendPrev;
  const outstandingPrev = sumInMonth(unpaid, lastMonth, (i) => i.issued_date, (i) => Number(i.amount));

  // revenue not yet invoiced — a package sold with no invoice against it
  let leak = 0;
  const unbilled: { client: string; pkg: string; amount: number; id: string }[] = [];
  for (const c of clients) {
    if (!c.package_id) continue;
    const p = pkgs.get(c.package_id);
    if (!p) continue;
    if (!invoices.some((i) => i.client_id === c.id)) {
      leak += Number(p.price);
      unbilled.push({ client: c.name, pkg: p.name, amount: Number(p.price), id: c.id });
    }
  }

  // ---- exception queue: every rupee that hasn't landed ---------------------
  const flags: Flag[] = [];
  for (const u of unbilled) {
    flags.push({ sev: "high", title: `${u.client} — no invoice raised`, detail: `${u.pkg} · ${money(u.amount)} never billed`, href: `/clients/${u.id}`, cta: "Raise" });
  }
  for (const i of unpaid) {
    const age = ageDays(i.issued_date, today);
    if (age >= 30) flags.push({ sev: "high", title: `INV-${String(i.num ?? 0).padStart(3, "0")} — ${age} days overdue`, detail: `${nameOf(i.client_id)} · ${money(Number(i.amount))}`, href: "/billing", cta: "Chase" });
    else if (age >= 7) flags.push({ sev: "med", title: `INV-${String(i.num ?? 0).padStart(3, "0")} unpaid`, detail: `${nameOf(i.client_id)} · ${money(Number(i.amount))} · ${age} days`, href: "/billing", cta: "Chase" });
  }
  for (const s of subs.filter((s) => s.status === "active" && s.renews_on && s.renews_on < today)) {
    flags.push({ sev: "high", title: `${nameOf(s.client_id)} — renewal missed`, detail: `Was due ${s.renews_on} · ${money(Number(s.amount ?? 0))}`, href: "/subscriptions", cta: "Renew" });
  }
  for (const cp of cps.filter((cp) => cp.status === "active" && cp.end_date && cp.end_date <= in30 && cp.end_date >= today)) {
    if (!subs.some((s) => s.client_id === cp.client_id && s.status === "active")) {
      flags.push({ sev: "med", title: `${nameOf(cp.client_id)} — package ends ${cp.end_date}`, detail: `${cp.package_name ?? "Package"} · no renewal booked`, href: "/subscriptions", cta: "Renew" });
    }
  }
  const order = { high: 0, med: 1, low: 2 };
  flags.sort((a, b) => order[a.sev] - order[b.sev]);

  // ---- ageing buckets ------------------------------------------------------
  const buckets = [
    { label: "0–7 days", min: 0, max: 7 },
    { label: "8–30 days", min: 8, max: 30 },
    { label: "31–60 days", min: 31, max: 60 },
    { label: "60+ days", min: 61, max: 99999 },
  ].map((b) => {
    const rows = unpaid.filter((i) => { const a = ageDays(i.issued_date, today); return a >= b.min && a <= b.max; });
    return { ...b, count: rows.length, amount: rows.reduce((s, i) => s + Number(i.amount), 0) };
  });

  const renewing = subs.filter((s) => s.status === "active" && s.renews_on && s.renews_on <= in30 && s.renews_on >= today);
  const renewalValue = renewing.reduce((s, r) => s + Number(r.amount ?? 0), 0);

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 21, margin: "0 0 2px" }}>Welcome back, {name.split(" ")[0]}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Finance view — what&apos;s been billed, what&apos;s been collected and what hasn&apos;t.
        </p>
      </div>

      {/* 1 — MONEY */}
      <div style={sectionTitle}>Money</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <MetricCard
          label="Revenue this month"
          value={money(revenueMonth)}
          sub={`${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`}
          // Slot 04. Revenue up is good, revenue down is bad — declared, not
          // inferred. Omitted entirely when there's no prior month to compare
          // against, rather than showing a meaningless ▲100%.
          trend={monthTrend(revenueMonth, revenuePrev, "revenue_month")}
          minWidth={190}
        />
        <MetricCard label="Outstanding" value={money(outstanding)} sub={`${unpaid.length} unpaid`} trend={monthTrend(outstanding, outstandingPrev, "outstanding")} color={outstanding ? "var(--red)" : undefined} minWidth={170} />
        <MetricCard label="Spend this month" value={money(spendMonth)} sub={`${expenses.filter((e) => (e.date ?? "").startsWith(month)).length} expense${expenses.filter((e) => (e.date ?? "").startsWith(month)).length === 1 ? "" : "s"}`} trend={monthTrend(spendMonth, spendPrev, "spend_month")} minWidth={170} />
        <MetricCard label="Net this month" value={money(netMonth)} sub="revenue − spend" trend={monthTrend(netMonth, netPrev, "net_month")} color={netMonth < 0 ? "var(--red)" : "var(--brand-text)"} minWidth={170} />
        <MetricCard label="Unbilled packages" value={money(leak)} sub="revenue not yet invoiced" color={leak ? "var(--amber-text-soft)" : undefined} minWidth={180} />
      </div>

      {/* 2 — NEEDS ATTENTION */}
      <AttentionPanel flags={flags} />

      {/* 3 — TODAY / COLLECTIONS */}
      <div style={sectionTitle}>Collections</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard value={`${collectRate}%`} label="Collection rate" href="/billing"
          meter={{ of: 100, filled: collectRate }} sub={`${money(collected)} of ${money(billed)} billed`} />
        <MetricCard value={unpaid.length} label="Unpaid invoices" href="/billing"
          meter={{ of: invoices.length || 1, filled: unpaid.length }} sub={`${money(outstanding)} outstanding`} />
        <MetricCard value={renewing.length} label="Renewals ≤30 days" href="/subscriptions"
          meter={{ of: subs.length || 1, filled: renewing.length }} sub={money(renewalValue)} />
        <MetricCard value={unbilled.length} label="Unbilled clients" href="/clients"
          meter={{ of: clients.length || 1, filled: unbilled.length }} sub={`${money(leak)} to invoice`} />
      </div>

      {/* 4 — SUPPORTING DETAIL */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Receivables ageing</div>
          {buckets.map((b, i) => {
            const pct = outstanding ? Math.round((b.amount / outstanding) * 100) : 0;
            return (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5, borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 84 }}>{b.label}</span>
                <div style={{ flex: 1, background: "var(--neutral-bg)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: b.min >= 31 ? "var(--red)" : b.min >= 8 ? "var(--amber)" : "var(--brand-fill)" }} />
                </div>
                <span style={{ color: "var(--muted)", minWidth: 96, textAlign: "right" }}>{money(b.amount)} · {b.count}</span>
              </div>
            );
          })}
          {!unpaid.length && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>Nothing outstanding — everything billed is collected.</div>}
        </div>

        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Recent invoices</div>
            <span style={{ flex: 1 }} />
            <Link href="/billing" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>Billing →</Link>
          </div>
          {invoices.length ? invoices.slice().sort((a, b) => (b.num ?? 0) - (a.num ?? 0)).slice(0, 8).map((i, n) => (
            <div key={i.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: n ? "1px solid var(--border)" : "none", fontSize: 12.5 }}>
              <span style={{ color: "var(--muted)", minWidth: 56 }}>INV-{String(i.num ?? 0).padStart(3, "0")}</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(i.client_id)}</span>
              <span style={{ fontWeight: 600 }}>{money(Number(i.amount))}</span>
              <span style={{
                background: i.status === "Paid" ? "var(--green-bg)" : "var(--red-bg)",
                color: i.status === "Paid" ? "var(--green-text)" : "var(--red-text)",
                borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700, minWidth: 48, textAlign: "center",
              }}>{i.status}</span>
            </div>
          )) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No invoices raised yet.</div>}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/expenses" style={qa}>Expenses</Link>
            <Link href="/finsheets" style={qa}>Finance Sheets</Link>
            <Link href="/claims" style={qa}>Insurance</Link>
            <Link href="/reports" style={qa}>Reports</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
