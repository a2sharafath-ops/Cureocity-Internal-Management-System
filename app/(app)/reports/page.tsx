import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { selectAll } from "@/lib/select-all";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MetricCard from "@/components/MetricCard";
import { pipelineTotals, pipelineByStage, targetOutlook } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

function money(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

const STAGES = ["1-New Lead", "2-Discovery", "3-Product Match", "4-Visit/Trial", "5-Close", "6-Nurture", "LOST"];

function pkgType(id: string | null): string {
  if (!id) return "None";
  if (id.startsWith("fm")) return "Facility";
  if (id.startsWith("pt")) return "Personal Training";
  if (id.startsWith("comp")) return "Comprehensive";
  if (id === "bp1") return "BluePrint";
  return "Other";
}

function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, label: dt.toLocaleDateString("en-GB", { month: "short" }) });
  }
  return out;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
      <div style={{ fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Bars({ data, color, fmt }: { data: { label: string; value: number }[]; color: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
          <span style={{ width: 120, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
          <div style={{ flex: 1, background: "var(--neutral-bg)", borderRadius: 6, height: 20, overflow: "hidden" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: color, borderRadius: 6, minWidth: d.value > 0 ? 2 : 0 }} />
          </div>
          <span style={{ width: 90, textAlign: "right", fontWeight: 600 }}>{fmt ? fmt(d.value) : d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/reports")) redirect("/dashboard");

  const supabase = createClient();
  const nowMs = Date.now();
  const days30Ago = new Date(nowMs - 30 * 86400000).toISOString().slice(0, 10);
  const [{ data: invData }, { data: leadData }, { data: clientData }, sessTotal, sessDone, { data: subData }, { data: recentSess }] = await Promise.all([
    supabase.from("invoices").select("amount, status, paid_date"),
    selectAll((f, t) => supabase.from("leads").select("stage, expected_value, expected_close, disqualified_at").range(f, t)),
    supabase.from("clients").select("package_id, joined"),
    supabase.from("sessions").select("id", { count: "exact", head: true }),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("subscriptions").select("amount, interval_days, status").eq("status", "active"),
    supabase.from("sessions").select("client_id").gte("date", days30Ago),
  ]);

  const invoices = (invData ?? []) as { amount: number; status: string; paid_date: string | null }[];
  const leads = (leadData ?? []) as { stage: string | null }[];
  const clients = (clientData ?? []) as { package_id: string | null; joined: string | null }[];
  const subs = (subData ?? []) as { amount: number; interval_days: number; status: string }[];
  const activeClientIds = new Set(((recentSess ?? []) as { client_id: string }[]).map((s) => s.client_id));

  // revenue by month
  const months = lastMonths(6);
  const revByMonth = new Map(months.map((m) => [m.key, 0]));
  let totalPaid = 0, outstanding = 0;
  for (const i of invoices) {
    if (i.status === "Paid") {
      totalPaid += Number(i.amount);
      const k = (i.paid_date ?? "").slice(0, 7);
      if (revByMonth.has(k)) revByMonth.set(k, (revByMonth.get(k) ?? 0) + Number(i.amount));
    } else if (i.status === "Unpaid") {
      outstanding += Number(i.amount);
    }
  }
  const revenueData = months.map((m) => ({ label: m.label, value: revByMonth.get(m.key) ?? 0 }));
  // These two were already computed for the 6-month chart and thrown away by
  // the KPI row. All-time revenue can't carry a month-over-month trend — it
  // only ever rises — so the current month becomes slot 03 context instead,
  // which is the honest version of a baseline for a cumulative figure.
  const thisMonthRev = revByMonth.get(months[months.length - 1].key) ?? 0;

  // lead funnel
  const stageCounts = new Map(STAGES.map((s) => [s, 0]));
  for (const l of leads) if (l.stage && stageCounts.has(l.stage)) stageCounts.set(l.stage, (stageCounts.get(l.stage) ?? 0) + 1);
  const funnelData = STAGES.map((s) => ({ label: s, value: stageCounts.get(s) ?? 0 }));

  // package mix
  const mix = new Map<string, number>();
  for (const c of clients) { const t = pkgType(c.package_id); mix.set(t, (mix.get(t) ?? 0) + 1); }
  const mixData = [...mix.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const totalSessions = sessTotal.count ?? 0;
  const completedSessions = sessDone.count ?? 0;
  const completionRate = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // LTV / ARPU / MRR / retention
  const clientCount = clients.length || 1;
  const ltv = totalPaid / clientCount;                          // avg realised revenue per client
  const mrr = subs.reduce((s, x) => s + Number(x.amount) * (30 / (x.interval_days || 30)), 0);
  const runRate = mrr * 12;                                     // annual run-rate from active subs
  const activeCount = activeClientIds.size;
  const retention = clients.length ? Math.round((Math.min(activeCount, clients.length) / clients.length) * 100) : 0;

  // new members by join month (cohorts)
  const newByMonth = new Map(months.map((m) => [m.key, 0]));
  for (const c of clients) { const k = (c.joined ?? "").slice(0, 7); if (newByMonth.has(k)) newByMonth.set(k, (newByMonth.get(k) ?? 0) + 1); }
  const cohortData = months.map((m) => ({ label: m.label, value: newByMonth.get(m.key) ?? 0 }));

  // acquisition funnel: leads by stage → converted (active clients)
  const funnelStages = ["1-New Lead", "2-Discovery", "3-Product Match", "4-Visit/Trial", "5-Close"];
  const acqData = [
    ...funnelStages.map((s) => ({ label: s.replace(/^\d-/, ""), value: stageCounts.get(s) ?? 0 })),
    { label: "Converted (clients)", value: clients.length },
  ];

  // The forward-looking half. Everything above this line is realised revenue;
  // this is what could still land. Weighted, because the raw sum assumes every
  // open deal closes and would make the forecast a wish.
  const pipe = pipelineTotals(leads as unknown as Parameters<typeof pipelineTotals>[0]);
  const byStage = pipelineByStage(leads as unknown as Parameters<typeof pipelineByStage>[0]);
  const monthEnd = (() => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  })();
  // Window starts today, not at the epoch — a deal whose close date has already
  // slipped is not evidence about this month. It is reported separately.
  const todayStr = new Date().toISOString().slice(0, 10);
  const closingThisMonth = pipe.weightedBy(todayStr, monthEnd);
  const overdueClose = pipe.overdueValue(todayStr);
  const thisMonthRevenue = revByMonth.get(months[months.length - 1].key) ?? 0;
  const { data: targetRow } = await supabase.from("sales_targets")
    .select("revenue_target").eq("month", months[months.length - 1].key).maybeSingle();
  const target = Number(targetRow?.revenue_target ?? 0);
  const outlook = target > 0 ? targetOutlook(target, thisMonthRevenue, closingThisMonth) : null;

  const kpi = (label: string, value: string, sub?: string) => (
    <MetricCard label={label} value={value} sub={sub} minWidth={170} />
  );

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["invoices", "leads", "clients", "sessions"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Reports &amp; Analytics</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Live from your data</p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        {kpi("Total revenue", money(totalPaid), `${money(thisMonthRev)} this month`)}
        {kpi("Outstanding", money(outstanding), "unpaid")}
        {kpi("Active clients", String(clients.length))}
        {kpi("Session completion", `${completionRate}%`, `${completedSessions} of ${totalSessions}`)}
      </div>

      {/* Pipeline — the number Sales Targets could never show, because no lead
          carried an amount until now. */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        {kpi("Open pipeline", money(pipe.open), `${pipe.counted} deal${pipe.counted === 1 ? "" : "s"} with a value`)}
        {kpi("Weighted pipeline", money(pipe.weighted), "adjusted for stage close rates")}
        {kpi("Could close this month", money(closingThisMonth),
          overdueClose
            // Surfacing this matters: it used to be silently folded into the
            // number above, inflating it a little more every month.
            ? `by ${monthEnd} · ${money(overdueClose)} past its close date`
            : `by ${monthEnd}`)}
        {kpi("No value set", String(pipe.unvalued), pipe.unvalued ? "not in the forecast" : "all deals valued")}
      </div>

      {outlook && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 14 }}>This month&apos;s target</b>
            <span style={{
              background: outlook.canMake ? "var(--green-bg)" : "var(--amber-bg)",
              color: outlook.canMake ? "var(--green-text)" : "var(--amber-text)",
              borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 700,
            }}>
              {outlook.canMake ? "On track" : `${money(outlook.gap)} short`}
            </span>
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {money(thisMonthRevenue)} booked of {money(target)} — {outlook.attained}% attained.
            {" "}Plus {money(closingThisMonth)} weighted pipeline closing this month
            {" "}= <b>{money(outlook.projected)} projected</b>.
          </div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>
            Pipeline is weighted by stage close rate, so this is an expectation rather than a best case.
          </div>
        </div>
      )}

      {/* Money by stage — the funnel that counts rupees rather than heads. */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>Pipeline by stage</div>
        {byStage.map((r) => (
          <div key={r.stage} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 12.5 }}>
            <span style={{ minWidth: 130 }}>{r.stage}</span>
            <span style={{ color: "var(--muted)", minWidth: 60 }}>{r.count} lead{r.count === 1 ? "" : "s"}</span>
            <span style={{ minWidth: 90, textAlign: "right" }}>{money(r.value)}</span>
            <span style={{ color: "var(--muted)", minWidth: 46, textAlign: "right" }}>{Math.round(r.probability * 100)}%</span>
            <span style={{ flex: 1 }} />
            <b>{money(r.weighted)}</b>
          </div>
        ))}
        {byStage.every((r) => r.value === 0) && (
          <div style={{ color: "var(--muted)", fontSize: 12.5, paddingTop: 8 }}>
            No expected values set yet — open a lead and fill in the Opportunity panel.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        {kpi("LTV / client", money(ltv), "realised revenue ÷ clients")}
        {kpi("MRR", money(mrr), "from active subscriptions")}
        {kpi("Annual run-rate", money(runRate), "MRR × 12")}
        {kpi("30-day retention", `${retention}%`, `${activeCount} active of ${clients.length}`)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Revenue — last 6 months">
          <Bars data={revenueData} color="var(--brand-fill)" fmt={money} />
        </Card>
        <Card title="Lead pipeline">
          <Bars data={funnelData} color="var(--purple)" />
        </Card>
        <Card title="Clients by package">
          <Bars data={mixData.length ? mixData : [{ label: "None", value: 0 }]} color="var(--blue)" />
        </Card>
        <Card title="Session completion">
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: "var(--brand-text)" }}>{completionRate}%</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{completedSessions} completed of {totalSessions} scheduled</div>
            <div style={{ marginTop: 12, background: "var(--neutral-bg)", borderRadius: 8, height: 12, overflow: "hidden" }}>
              <div style={{ width: `${completionRate}%`, height: "100%", background: "var(--brand-fill)" }} />
            </div>
          </div>
        </Card>
        <Card title="Acquisition funnel — leads → converted">
          <Bars data={acqData} color="var(--brand-fill)" />
        </Card>
        <Card title="New members by month (cohorts)">
          <Bars data={cohortData} color="var(--purple)" />
        </Card>
      </div>

      <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 18px", color: "var(--muted)", fontSize: 12 }}>
        LTV is realised revenue per client to date. CAC (cost per acquisition) needs marketing-spend data — add an ad-spend source to compute LTV:CAC and payback period.
      </div>
    </div>
  );
}
