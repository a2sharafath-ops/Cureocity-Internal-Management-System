import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";

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
          <div style={{ flex: 1, background: "#eef2f1", borderRadius: 6, height: 20, overflow: "hidden" }}>
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
  const [{ data: invData }, { data: leadData }, { data: clientData }, sessTotal, sessDone] = await Promise.all([
    supabase.from("invoices").select("amount, status, paid_date"),
    supabase.from("leads").select("stage"),
    supabase.from("clients").select("package_id"),
    supabase.from("sessions").select("id", { count: "exact", head: true }),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  const invoices = (invData ?? []) as { amount: number; status: string; paid_date: string | null }[];
  const leads = (leadData ?? []) as { stage: string | null }[];
  const clients = (clientData ?? []) as { package_id: string | null }[];

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

  const kpi = (label: string, value: string, sub?: string) => (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 16px", flex: 1, minWidth: 170 }}>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["invoices", "leads", "clients", "sessions"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Reports &amp; Analytics</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Live from your data</p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        {kpi("Total revenue", money(totalPaid), "all paid invoices")}
        {kpi("Outstanding", money(outstanding), "unpaid")}
        {kpi("Active clients", String(clients.length))}
        {kpi("Session completion", `${completionRate}%`, `${completedSessions} of ${totalSessions}`)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Revenue — last 6 months">
          <Bars data={revenueData} color="var(--teal)" fmt={money} />
        </Card>
        <Card title="Lead pipeline">
          <Bars data={funnelData} color="var(--purple)" />
        </Card>
        <Card title="Clients by package">
          <Bars data={mixData.length ? mixData : [{ label: "None", value: 0 }]} color="var(--blue)" />
        </Card>
        <Card title="Session completion">
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: "var(--teal-dark)" }}>{completionRate}%</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{completedSessions} completed of {totalSessions} scheduled</div>
            <div style={{ marginTop: 12, background: "#eef2f1", borderRadius: 8, height: 12, overflow: "hidden" }}>
              <div style={{ width: `${completionRate}%`, height: "100%", background: "var(--teal)" }} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
