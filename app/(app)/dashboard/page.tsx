import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";

import RealtimeRefresh from "@/components/RealtimeRefresh";

import { todayISO, todayLabel } from "@/lib/today";

export const dynamic = "force-dynamic";

const TODAY = todayISO();

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

function Kpi({ label, value, sub, href }: { label: string; value: number | string; sub?: string; href?: string }) {
  const inner = (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", minWidth: 165, flex: 1 }}>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{sub}{href ? " →" : ""}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", flex: 1 }}>{inner}</Link> : inner;
}

function Panel({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center" }}>
        <b style={{ fontSize: 14 }}>{title}</b>
        <span style={{ flex: 1 }} />
        {href && <Link href={href} style={{ color: "var(--teal-dark)", fontSize: 12, textDecoration: "none" }}>{linkLabel ?? "Open"} →</Link>}
      </div>
      {children}
    </div>
  );
}

export default async function DashboardPage() {
  const me = await getProfile();
  const { effective } = await getViewRole();
  const role = effective;
  const isOps = ["Administrator", "Manager", "Front Desk"].includes(role);
  const isPro = role === "Health Professional";
  const isAdmin = ["Administrator", "Manager"].includes(role);

  const supabase = createClient();

  const [clients, leads, sessToday, sessDone, consultsPend, bpClients, bloodPend] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("date", TODAY).eq("status", "scheduled"),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).neq("status", "completed"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("package_id", "bp1"),
    supabase.from("blood_requests").select("client_id", { count: "exact", head: true }).eq("submitted", false),
  ]);

  const [{ data: todaySessions }, { data: recentLeads }, { data: pendingConsults }] = await Promise.all([
    supabase.from("sessions").select("id, hour, clients(id, name), staff(name)").eq("date", TODAY).eq("status", "scheduled").order("hour").limit(8),
    supabase.from("leads").select("id, name, stage, source").order("num", { ascending: false }).limit(5),
    supabase.from("consultations").select("id, kind, clients(id, name)").neq("status", "completed").order("created_at", { ascending: false }).limit(6),
  ]);

  const today = (todaySessions ?? []) as unknown as { id: string; hour: number; clients: { id: string; name: string } | null; staff: { name: string } | null }[];
  const rleads = (recentLeads ?? []) as { id: string; name: string; stage: string | null; source: string | null }[];
  const pconsults = (pendingConsults ?? []) as unknown as { id: string; kind: string; clients: { id: string; name: string } | null }[];

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["sessions","leads","consultations"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        {me?.name} · {role} · today {todayLabel()}
      </p>

      {/* KPI row — tailored per role */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        {isOps && (
          <>
            <Kpi label="Active Clients" value={clients.count ?? 0} sub="View clients" href="/clients" />
            <Kpi label="Leads in pipeline" value={leads.count ?? 0} sub="View leads" href="/leads" />
            <Kpi label="Sessions Today" value={sessToday.count ?? 0} sub="Trainer board" href="/trainer" />
            <Kpi label="BluePrint clients" value={bpClients.count ?? 0} sub="BluePrint" href="/blueprint" />
            <Kpi label="Blood reports pending" value={bloodPend.count ?? 0} sub="BluePrint" href="/blueprint" />
          </>
        )}
        {isPro && (
          <>
            <Kpi label="Sessions Today" value={sessToday.count ?? 0} sub="Trainer board" href="/trainer" />
            <Kpi label="Consultations to complete" value={consultsPend.count ?? 0} sub="Professional" href="/pro" />
            <Kpi label="BluePrint clients" value={bpClients.count ?? 0} sub="BluePrint" href="/blueprint" />
            <Kpi label="Sessions completed" value={sessDone.count ?? 0} sub="all-time" />
          </>
        )}
        {!isOps && !isPro && (
          <>
            <Kpi label="Active Clients" value={clients.count ?? 0} />
            <Kpi label="Sessions completed" value={sessDone.count ?? 0} sub="all-time" />
          </>
        )}
      </div>

      {/* Panels — per role */}
      <div style={{ display: "grid", gridTemplateColumns: (isOps || isPro) ? "1.2fr 1fr" : "1fr", gap: 16 }}>
        {(isOps || isPro) && (
          <Panel title="Today's sessions" href="/trainer" linkLabel="Trainer board">
            {today.length ? today.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                <span style={{ width: 74, color: "var(--muted)", fontSize: 13 }}>{fmtHour(s.hour)}</span>
                {s.clients ? (
                  <Link href={`/clients/${s.clients.id}`} style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{s.clients.name}</Link>
                ) : "—"}
                <span style={{ flex: 1 }} />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{s.staff?.name ?? ""}</span>
              </div>
            )) : <div style={{ padding: "16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>No sessions scheduled today.</div>}
          </Panel>
        )}

        {isOps && (
          <Panel title="Recent leads" href="/leads" linkLabel="Pipeline">
            {rleads.length ? rleads.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{l.name}</b>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{l.source ?? "—"}</div>
                </div>
                <span style={{ background: "var(--purple-bg)", color: "#6d28d9", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{l.stage ?? "—"}</span>
              </div>
            )) : <div style={{ padding: "16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>No leads yet.</div>}
          </Panel>
        )}

        {(isPro || isAdmin) && (
          <Panel title="Consultations to complete" href="/pro" linkLabel="Professional">
            {pconsults.length ? pconsults.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                <span style={{ background: "var(--teal-light)", color: "var(--teal-dark)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{c.kind}</span>
                {c.clients ? (
                  <Link href={`/clients/${c.clients.id}`} style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{c.clients.name}</Link>
                ) : "—"}
              </div>
            )) : <div style={{ padding: "16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>Nothing pending — all consultations completed.</div>}
          </Panel>
        )}
      </div>

      {!isOps && !isPro && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", color: "var(--muted)", fontSize: 13 }}>
          Welcome, {me?.name}. Your role ({role}) has a focused view for now — more tools for your area will be added as we port them.
        </div>
      )}
    </div>
  );
}
