import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canSetTargets } from "@/lib/roles";
import { selectAll } from "@/lib/select-all";
import { todayISO } from "@/lib/today";
import { pipelineTotals, targetOutlook } from "@/lib/pipeline";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import TargetForm from "@/components/TargetForm";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function TargetsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/targets")) redirect("/dashboard");
  const canSet = canSetTargets(me.role);

  const today = todayISO();
  const month = today.slice(0, 7);
  const monthStart = month + "-01";
  const monthLabel = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const supabase = createClient();
  const [{ data: targetRow }, { data: paidInv }, clientsC, { data: renewInv }, { data: leadRows }] = await Promise.all([
    supabase.from("sales_targets").select("revenue_target, new_clients_target, renewals_target, set_by").eq("month", month).maybeSingle(),
    supabase.from("invoices").select("amount").eq("status", "Paid").gte("paid_date", monthStart),
    supabase.from("clients").select("id", { count: "exact", head: true }).gte("joined", monthStart),
    supabase.from("invoices").select("id").ilike("description", "%renewal%").gte("issued_date", monthStart),
    // Same source Reports uses, so both pages answer the target question
    // identically. Previously this page compared booked revenue to target and
    // ignored the pipeline entirely, so the two screens disagreed about
    // whether the month was on track.
    // Page through all leads — the server caps a single response at 1000 rows,
    // which would silently undercount the pipeline once the book passes 1000.
    selectAll((f, t) => supabase.from("leads").select("stage, expected_value, expected_close, disqualified_at").range(f, t)),
  ]);

  const target = (targetRow ?? { revenue_target: 0, new_clients_target: 0, renewals_target: 0, set_by: null }) as { revenue_target: number; new_clients_target: number; renewals_target: number; set_by: string | null };
  const revenue = ((paidInv ?? []) as { amount: number }[]).reduce((s, i) => s + Number(i.amount), 0);
  const newClients = clientsC.count ?? 0;
  const renewals = ((renewInv ?? []) as { id: string }[]).length;

  const monthEnd = new Date(Date.UTC(
    new Date(today + "T00:00:00Z").getUTCFullYear(),
    new Date(today + "T00:00:00Z").getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const pipe = pipelineTotals((leadRows ?? []) as Parameters<typeof pipelineTotals>[0]);
  const closingThisMonth = pipe.weightedBy(today, monthEnd);
  const outlook = target.revenue_target > 0
    ? targetOutlook(target.revenue_target, revenue, closingThisMonth)
    : null;

  const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" };

  const goal = (title: string, val: number, tgt: number, fmt: (n: number) => string, note: string, outlookNote?: string | null) => {
    const pct = tgt ? Math.min(100, Math.round((val / tgt) * 100)) : 0;
    const hit = tgt > 0 && val >= tgt;
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>{title}</b>
          <span style={{ flex: 1 }} />
          {tgt > 0 && (hit
            ? <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>🎉 Target hit</span>
            : <span style={{ background: "var(--amber-bg)", color: "var(--amber-text-soft)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{fmt(tgt - val)} to go</span>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, background: "var(--neutral-bg)", borderRadius: 8, height: 14, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: hit ? "var(--green)" : "var(--brand-fill)" }} />
          </div>
          <b style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fmt(val)} / {tgt > 0 ? fmt(tgt) : "—"} · {pct}%</b>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>{note}</div>
        {outlookNote && (
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
            {outlookNote}
            <div style={{ fontSize: 11, marginTop: 3, opacity: .8 }}>
              Weighted by stage close rate — an expectation, not a best case.
            </div>
          </div>
        )}
      </div>
    );
  };

  const noTarget = !targetRow;

  return (
    <div style={{ maxWidth: 940 }}>
      <RealtimeRefresh tables={["sales_targets", "invoices", "clients"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Sales Targets</h1>
        <span style={{ flex: 1 }} />
        {canSet && <TargetForm month={month} revenue={target.revenue_target} newClients={target.new_clients_target} renewals={target.renewals_target} />}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>
        Targets for <b>{monthLabel}</b> — {canSet ? "set by Admin" : "set by Admin"} · progress updates live as payments and onboardings happen.
      </p>

      {noTarget && (
        <div style={{ background: "var(--neutral-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--muted)" }}>
          No targets set for {monthLabel} yet.{canSet ? " Click “Set targets” to add this month's goals." : " Ask an Administrator to set this month's goals."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {goal("💰 Revenue Target", revenue, target.revenue_target, money,
          `${((paidInv ?? []) as unknown[]).length} payments collected this month`,
          // Booked revenue alone only ever says how far behind you are. The
          // weighted pipeline says whether the month is still reachable —
          // which is the question anyone opening this page is actually asking.
          outlook && closingThisMonth > 0
            ? (outlook.canMake
                ? `Plus ${money(closingThisMonth)} weighted pipeline closing this month — ${money(outlook.projected)} projected, on track.`
                : `Plus ${money(closingThisMonth)} weighted pipeline closing this month — ${money(outlook.projected)} projected, still ${money(outlook.gap)} short.`)
            : outlook
              ? "No pipeline with an expected close date this month, so this is booked revenue only."
              : null)}
        {goal("👥 New Clients", newClients, target.new_clients_target, (x) => String(x), `clients joined in ${monthLabel}`)}
        {goal("🔄 Renewals", renewals, target.renewals_target, (x) => String(x), "renewal invoices raised this month")}
        <div style={card}>
          <b style={{ fontSize: 14 }}>This month</b>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12, fontSize: 14 }}>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Revenue</div><b>{money(revenue)}</b></div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>New clients</div><b>{newClients}</b></div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Renewals</div><b>{renewals}</b></div>
          </div>
          {target.set_by && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>Targets set by {target.set_by}</div>}
        </div>
      </div>
    </div>
  );
}
