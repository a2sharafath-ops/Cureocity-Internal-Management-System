import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Today, per the prototype's fixed demo date.
const TODAY = "2026-07-02";

function Kpi({
  label, value, sub, href,
}: { label: string; value: string | number; sub?: string; href?: string }) {
  const inner = (
    <div
      style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px",
        minWidth: 180, flex: 1,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{sub}{href ? " →" : ""}</div>}
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", flex: 1 }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function DashboardPage() {
  const supabase = createClient();

  const [clients, leads, sessionsToday, completed] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("date", TODAY).eq("status", "scheduled"),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Overview · live from Supabase · today Thu, Jul 2, 2026
      </p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Kpi label="Active Clients" value={clients.count ?? 0} sub="View clients" href="/clients" />
        <Kpi label="Leads in pipeline" value={leads.count ?? 0} sub="View leads" href="/leads" />
        <Kpi label="Sessions Today" value={sessionsToday.count ?? 0} sub="Scheduled strength sessions" href="/sessions" />
        <Kpi label="Sessions Completed" value={completed.count ?? 0} sub="All-time (seed)" />
      </div>

      <div
        style={{
          marginTop: 20, background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px",
          color: "var(--muted)", fontSize: 13,
        }}
      >
        More coming: this dashboard will grow with revenue, renewals, today&apos;s schedule, and
        per-role views as we port them from the prototype.
      </div>
    </div>
  );
}
