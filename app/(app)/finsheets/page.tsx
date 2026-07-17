import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { PayableForm, EstimateForm, LedgerForm } from "@/components/FinanceForms";
import { PayPayable, EstimateActions } from "@/components/FinanceActions";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const TABS = [
  { key: "sales", label: "🧾 Sales" },
  { key: "payable", label: "📤 Payables" },
  { key: "estimates", label: "📝 Estimates" },
  { key: "bank", label: "🏦 Bank" },
  { key: "cash", label: "💵 Cash" },
];

type Ledger = { id: string; date: string; ref: string | null; party: string | null; kind: string | null; direction: string; amount: number };

export default async function FinsheetsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/finsheets")) redirect("/dashboard");
  const tab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "sales";

  const supabase = createClient();
  const [{ data: invData }, { data: payData }, { data: estData }, { data: ledData }] = await Promise.all([
    supabase.from("invoices").select("id, num, description, amount, status, paid_date, clients(name)").eq("status", "Paid").order("paid_date", { ascending: false }).limit(200),
    supabase.from("payables").select("id, vendor, item, amount, due_date, status").order("due_date"),
    supabase.from("estimates").select("id, lead_name, item, amount, date, status").order("date", { ascending: false }),
    supabase.from("ledger").select("id, account, date, ref, party, kind, direction, amount").order("date", { ascending: false }).limit(300),
  ]);
  const sales = (invData ?? []) as unknown as { id: string; num: number | null; description: string | null; amount: number; paid_date: string | null; clients: { name: string } | null }[];
  const payables = (payData ?? []) as { id: string; vendor: string; item: string | null; amount: number; due_date: string | null; status: string }[];
  const estimates = (estData ?? []) as { id: string; lead_name: string; item: string | null; amount: number; date: string; status: string }[];
  const ledger = (ledData ?? []) as (Ledger & { account: string })[];
  const bank = ledger.filter((l) => l.account === "bank");
  const cash = ledger.filter((l) => l.account === "cash");

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const bal = (rows: Ledger[]) => rows.reduce((s, r) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0);

  const tabLink = (key: string, label: string) => (
    <Link href={`/finsheets?tab=${key}`} style={{ padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)", background: tab === key ? "var(--teal)" : "#fff", color: tab === key ? "#fff" : "var(--muted)" }}>{label}</Link>
  );
  const dirChip = (d: string) => <span style={{ color: d === "in" ? "#166534" : "var(--red)", fontWeight: 700, fontSize: 13 }}>{d === "in" ? "+" : "−"}</span>;

  const ledgerTable = (rows: (Ledger & { account: string })[], acct: "bank" | "cash") => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ ...box, padding: "12px 16px" }}><div style={{ fontSize: 12, color: "var(--muted)" }}>{acct === "bank" ? "Bank" : "Cash"} balance (from entries)</div><div style={{ fontSize: 20, fontWeight: 700, color: bal(rows) >= 0 ? "var(--teal-dark)" : "var(--red)" }}>{money(bal(rows))}</div></div>
        <span style={{ flex: 1 }} />
        <LedgerForm account={acct} />
      </div>
      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Date</th><th style={th}>{acct === "bank" ? "Party" : "Description"}</th>{acct === "bank" && <th style={th}>Ref / type</th>}<th style={th}>In/Out</th><th style={th}>Amount</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.date}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.party ?? "—"}</td>
                {acct === "bank" && <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.ref ?? ""}{r.kind ? ` · ${r.kind}` : ""}</td>}
                <td style={td}>{dirChip(r.direction)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{money(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={acct === "bank" ? 5 : 4} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["payables", "estimates", "ledger", "invoices"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Finance Sheets</h1>
        <span style={{ flex: 1 }} />
        {tab === "payable" && <PayableForm />}
        {tab === "estimates" && <EstimateForm />}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Sales · Payables · Estimates · Bank payments · Cash statement</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>{TABS.map((t) => tabLink(t.key, t.label))}</div>

      {tab === "sales" && (
        <div style={{ ...box, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontWeight: 700 }}>Collected — {money(sales.reduce((s, i) => s + Number(i.amount), 0))} · {sales.length} payments</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>#</th><th style={th}>Client</th><th style={th}>Description</th><th style={th}>Paid</th><th style={th}>Amount</th></tr></thead>
            <tbody>
              {sales.map((i) => (
                <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, color: "var(--muted)" }}>INV-{String(i.num ?? 0).padStart(3, "0")}</td>
                  <td style={td}>{i.clients?.name ?? "—"}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{i.description}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{i.paid_date ?? "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{money(i.amount)}</td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No paid invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "payable" && (
        <div style={{ ...box, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Vendor</th><th style={th}>Item</th><th style={th}>Due</th><th style={th}>Amount</th><th style={th}>Status</th><th style={th} /></tr></thead>
            <tbody>
              {payables.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.vendor}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{r.item ?? "—"}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.due_date ?? "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{money(r.amount)}</td>
                  <td style={td}><span style={{ background: r.status === "Paid" ? "var(--green-bg)" : "var(--amber-bg)", color: r.status === "Paid" ? "#166534" : "#b45309", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{r.status}</span></td>
                  <td style={{ ...td, textAlign: "right" }}>{r.status !== "Paid" && <PayPayable id={r.id} />}</td>
                </tr>
              ))}
              {payables.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No payables.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "estimates" && (
        <div style={{ ...box, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Prospect</th><th style={th}>Item</th><th style={th}>Date</th><th style={th}>Amount</th><th style={th}>Status</th><th style={th} /></tr></thead>
            <tbody>
              {estimates.map((r) => {
                const chip: Record<string, [string, string]> = { Accepted: ["var(--green-bg)", "#166534"], Sent: ["#dbeafe", "#2563eb"], Draft: ["#eef2f1", "var(--muted)"], Expired: ["#fee2e2", "var(--red)"] };
                const [bg, c] = chip[r.status] ?? ["#eef2f1", "var(--muted)"];
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.lead_name}</td>
                    <td style={{ ...td, color: "var(--muted)" }}>{r.item ?? "—"}</td>
                    <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.date}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{money(r.amount)}</td>
                    <td style={td}><span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{r.status}</span></td>
                    <td style={{ ...td, textAlign: "right" }}><EstimateActions id={r.id} status={r.status} /></td>
                  </tr>
                );
              })}
              {estimates.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No estimates.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bank" && ledgerTable(bank, "bank")}
      {tab === "cash" && ledgerTable(cash, "cash")}
    </div>
  );
}
