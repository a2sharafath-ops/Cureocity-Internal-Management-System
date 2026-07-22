import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canReimburseSubmit, canReimburseApprove, canClaims } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { PayableForm, EstimateForm, LedgerForm, ReimbursementForm, TopUpForm, EditFloatForm } from "@/components/FinanceForms";
import { PayPayable, EstimateActions, ReimbursementActions } from "@/components/FinanceActions";
import SegTabs from "@/components/SegTabs";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const TABS = [
  { key: "sales", label: "🧾 Sales" },
  { key: "payable", label: "📤 Payables" },
  { key: "estimates", label: "📝 Estimates" },
  { key: "bank", label: "🏦 Bank" },
  { key: "cash", label: "💵 Cash" },
  { key: "reimburse", label: "🔁 Reimbursements" },
];

type Ledger = { id: string; date: string; ref: string | null; party: string | null; kind: string | null; direction: string; amount: number; voucher_no: number | null };

export default async function FinsheetsPage({ searchParams }: { searchParams: { tab?: string; cash?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/finsheets")) redirect("/dashboard");
  const tab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "sales";
  const cashView = searchParams.cash === "payments" ? "payments" : "receipts";

  const supabase = createClient();
  const [{ data: invData }, { data: payData }, { data: estData }, { data: ledData }, { data: reimbData }, { data: staffData }, { data: pettyCfg }] = await Promise.all([
    supabase.from("invoices").select("id, num, description, amount, status, paid_date, clients(name)").eq("status", "Paid").order("paid_date", { ascending: false }).limit(200),
    supabase.from("payables").select("id, vendor, item, amount, due_date, status").order("due_date"),
    supabase.from("estimates").select("id, lead_name, item, amount, date, status").order("date", { ascending: false }),
    supabase.from("ledger").select("id, account, date, ref, party, kind, direction, amount, voucher_no").order("date", { ascending: false }).limit(300),
    supabase.from("reimbursements").select("id, payee_name, description, category, amount, incurred_date, status, receipt_bucket, receipt_path, pay_account, submitted_by").order("created_at", { ascending: false }).limit(300),
    supabase.from("staff").select("id, name").order("name"),
    supabase.from("petty_cash_config").select("float_amount, low_threshold").eq("id", true).maybeSingle(),
  ]);
  const reimbursements = (reimbData ?? []) as { id: string; payee_name: string; description: string; category: string; amount: number; incurred_date: string; status: string; receipt_bucket: string | null; receipt_path: string | null; pay_account: string | null; submitted_by: string | null }[];
  const staff = (staffData ?? []) as { id: string; name: string }[];
  const canSubmitReimb = canReimburseSubmit(me.role);
  const canApproveReimb = canReimburseApprove(me.role);
  // Signed URLs for any receipts, so the private bucket stays private.
  const receiptUrls: Record<string, string> = {};
  await Promise.all(reimbursements.filter((r) => r.receipt_path).map(async (r) => {
    const { data: signed } = await supabase.storage.from(r.receipt_bucket || "finance").createSignedUrl(r.receipt_path!, 3600);
    if (signed?.signedUrl) receiptUrls[r.id] = signed.signedUrl;
  }));
  const sales = (invData ?? []) as unknown as { id: string; num: number | null; description: string | null; amount: number; paid_date: string | null; clients: { name: string } | null }[];
  const payables = (payData ?? []) as { id: string; vendor: string; item: string | null; amount: number; due_date: string | null; status: string }[];
  const estimates = (estData ?? []) as { id: string; lead_name: string; item: string | null; amount: number; date: string; status: string }[];
  const ledger = (ledData ?? []) as (Ledger & { account: string })[];
  const bank = ledger.filter((l) => l.account === "bank");
  const cash = ledger.filter((l) => l.account === "cash");
  const cashReceipts = cash.filter((l) => l.direction === "in");
  const cashPayments = cash.filter((l) => l.direction === "out");
  const floatAmount = Number(pettyCfg?.float_amount ?? 0);
  const lowThreshold = Number(pettyCfg?.low_threshold ?? 0);
  const canManageFinance = canClaims(me.role); // Admin/Manager/Finance/Super Admin manage the float + top-ups

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const bal = (rows: Ledger[]) => rows.reduce((s, r) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0);

  const dirChip = (d: string) => <span style={{ color: d === "in" ? "var(--green-text)" : "var(--red)", fontWeight: 700, fontSize: 13 }}>{d === "in" ? "+" : "−"}</span>;

  const ledgerTable = (rows: (Ledger & { account: string })[], acct: "bank" | "cash") => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ ...box, padding: "12px 16px" }}><div style={{ fontSize: 12, color: "var(--muted)" }}>{acct === "bank" ? "Bank" : "Cash"} balance (from entries)</div><div style={{ fontSize: 20, fontWeight: 700, color: bal(rows) >= 0 ? "var(--brand-text)" : "var(--red)" }}>{money(bal(rows))}</div></div>
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
      <RealtimeRefresh tables={["payables", "estimates", "ledger", "invoices", "reimbursements"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Finance Sheets</h1>
        <span style={{ flex: 1 }} />
        {tab === "payable" && <PayableForm />}
        {tab === "estimates" && <EstimateForm />}
        {tab === "reimburse" && canSubmitReimb && <ReimbursementForm staff={staff} />}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Sales · Payables · Estimates · Bank payments · Cash statement</p>

      <div style={{ marginBottom: 16 }}><SegTabs active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, href: `/finsheets?tab=${t.key}` }))} /></div>

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
                  <td style={td}><span style={{ background: r.status === "Paid" ? "var(--green-bg)" : "var(--amber-bg)", color: r.status === "Paid" ? "var(--green-text)" : "var(--amber-text-soft)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{r.status}</span></td>
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
                const chip: Record<string, [string, string]> = { Accepted: ["var(--green-bg)", "var(--green-text)"], Sent: ["var(--blue-bg)", "var(--blue)"], Draft: ["var(--neutral-bg)", "var(--muted)"], Expired: ["var(--red-bg)", "var(--red)"] };
                const [bg, c] = chip[r.status] ?? ["var(--neutral-bg)", "var(--muted)"];
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

      {tab === "cash" && (() => {
        const inHand = bal(cash);
        const low = lowThreshold > 0 && inHand <= lowThreshold;
        const topUpNeeded = Math.max(0, floatAmount - inHand);
        const rows = cashView === "payments" ? cashPayments : cashReceipts;
        const sheetTotal = rows.reduce((s, r) => s + Number(r.amount), 0);
        const vno = (r: Ledger) => (r.direction === "in" ? "RV-" : "PV-") + String(r.voucher_no ?? 0).padStart(3, "0");
        return (
          <>
            {/* imprest float + cash-in-hand panel */}
            <div style={{ ...box, padding: 16, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
              <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Cash in hand</div><div style={{ fontSize: 22, fontWeight: 700, color: low ? "var(--red)" : "var(--brand-text)" }}>{money(inHand)}</div></div>
              <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Float (imprest)</div><div style={{ fontSize: 18, fontWeight: 600 }}>{money(floatAmount)}</div></div>
              {low && <div style={{ background: "var(--amber-bg)", color: "var(--amber-text-soft)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>⚠ Low — top up {money(topUpNeeded)} to restore float</div>}
              <span style={{ flex: 1 }} />
              {canManageFinance && <EditFloatForm float={floatAmount} threshold={lowThreshold} />}
              {canManageFinance && <TopUpForm />}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <SegTabs active={cashView} items={[
                { key: "receipts", label: `Receipts · ${cashReceipts.length}`, href: "/finsheets?tab=cash&cash=receipts" },
                { key: "payments", label: `Payments · ${cashPayments.length}`, href: "/finsheets?tab=cash&cash=payments" },
              ]} />
              <span style={{ flex: 1 }} />
              <LedgerForm account="cash" />
            </div>

            <div style={{ ...box, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", fontWeight: 700, borderBottom: "1px solid var(--border)" }}>
                {cashView === "payments" ? "Payment vouchers" : "Receipt vouchers"} — {money(sheetTotal)} · {rows.length} {rows.length === 1 ? "entry" : "entries"}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Voucher</th><th style={th}>Date</th><th style={th}>{cashView === "payments" ? "Paid to" : "Received from"}</th><th style={th}>Type</th><th style={th}>Amount</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontWeight: 700, color: "var(--brand-text)", fontVariantNumeric: "tabular-nums" }}>{vno(r)}</td>
                      <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.date}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.party ?? "—"}</td>
                      <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.kind ?? "Cash"}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{money(r.amount)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No {cashView === "payments" ? "payments" : "receipts"} yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {tab === "reimburse" && (() => {
        const owed = reimbursements.filter((r) => r.status === "Submitted" || r.status === "Approved").reduce((s, r) => s + Number(r.amount), 0);
        const chip: Record<string, [string, string]> = { Paid: ["var(--green-bg)", "var(--green-text)"], Approved: ["var(--blue-bg)", "var(--blue)"], Submitted: ["var(--amber-bg)", "var(--amber-text-soft)"], Rejected: ["var(--red-bg)", "var(--red)"] };
        return (
          <>
            <div style={{ ...box, padding: "12px 16px", marginBottom: 12, display: "inline-block" }}><div style={{ fontSize: 12, color: "var(--muted)" }}>Owed to staff (submitted + approved)</div><div style={{ fontSize: 20, fontWeight: 700, color: owed > 0 ? "var(--amber-text-soft)" : "var(--brand-text)" }}>{money(owed)}</div></div>
            <div style={{ ...box, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Paid by</th><th style={th}>For</th><th style={th}>Category</th><th style={th}>Date</th><th style={th}>Receipt</th><th style={th}>Amount</th><th style={th}>Status</th><th style={th} /></tr></thead>
                <tbody>
                  {reimbursements.map((r) => {
                    const [bg, c] = chip[r.status] ?? ["var(--neutral-bg)", "var(--muted)"];
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ ...td, fontWeight: 600 }}>{r.payee_name}</td>
                        <td style={{ ...td, color: "var(--muted)" }}>{r.description}</td>
                        <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.category}</td>
                        <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.incurred_date}</td>
                        <td style={td}>{receiptUrls[r.id] ? <a href={receiptUrls[r.id]} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", fontSize: 13 }}>View</a> : <span style={{ color: "var(--muted)", fontSize: 13 }}>—</span>}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{money(r.amount)}</td>
                        <td style={td}><span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{r.status}{r.status === "Paid" && r.pay_account ? ` · ${r.pay_account}` : ""}</span></td>
                        <td style={{ ...td, textAlign: "right" }}><ReimbursementActions id={r.id} status={r.status} canApprove={canApproveReimb} /></td>
                      </tr>
                    );
                  })}
                  {reimbursements.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No reimbursement claims.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}
    </div>
  );
}
