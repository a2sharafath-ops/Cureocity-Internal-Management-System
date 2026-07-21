import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { deleteExpense } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MetricCard from "@/components/MetricCard";
import { monthTrend, prevMonthKey, sumInMonth } from "@/lib/trend";
import ExpenseForm from "@/components/ExpenseForm";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
type Exp = { id: string; description: string; category: string; amount: number; date: string; created_by: string | null };

export default async function ExpensesPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/expenses")) redirect("/dashboard");

  const supabase = createClient();
  const { data } = await supabase.from("expenses").select("id, description, category, amount, date, created_by").order("date", { ascending: false }).limit(200);
  const expenses = (data ?? []) as Exp[];

  const month = todayISO().slice(0, 7);
  const monthTotal = expenses.filter((e) => (e.date ?? "").startsWith(month)).reduce((s, e) => s + Number(e.amount), 0);
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  // `date` is already selected; the 200-row cap is the only limit on how far
  // back the comparison can see.
  const lastMonth = prevMonthKey(month);
  const monthPrev = sumInMonth(expenses, lastMonth, (e) => e.date, (e) => Number(e.amount));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const stat = (label: string, value: string, sub?: string, trend?: ReturnType<typeof monthTrend>) =>
    <MetricCard label={label} value={value} sub={sub} trend={trend} minWidth={160} />;

  return (
    <div style={{ maxWidth: 980 }}>
      <RealtimeRefresh tables={["expenses"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Expenses</h1>
        <span style={{ flex: 1 }} />
        <ExpenseForm />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Operating costs &amp; profitability.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {/* spend rising is bad — declared, never inferred from the sign */}
        {stat("This month", money(monthTotal), `${expenses.filter((e) => (e.date ?? "").startsWith(month)).length} entries`, monthTrend(monthTotal, monthPrev, "spend_month"))}
        {stat("All time", money(total), `${expenses.length} entries`)}
        {topCats.map(([c, v]) => stat(c, money(v)))}
      </div>

      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Description</th><th style={th}>Category</th><th style={th}>Amount</th><th style={th} /></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{e.date}</td>
                <td style={{ ...td, fontWeight: 600 }}>{e.description}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{e.category}</td>
                <td style={{ ...td, fontWeight: 600 }}>{money(e.amount)}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <form action={deleteExpense}><input type="hidden" name="id" value={e.id} /><button type="submit" title="Remove" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>✕</button></form>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No expenses recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
