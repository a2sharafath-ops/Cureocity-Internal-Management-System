import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StatCard from "@/components/StatCard";
import CheckinForm from "@/components/CheckinForm";

export const dynamic = "force-dynamic";

type Row = { id: string; guest_name: string | null; method: string; direction: string; at: string; by_name: string | null; clients: { id: string; name: string } | null };

export default async function AccessPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/access")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: rows }, { data: clientData }] = await Promise.all([
    supabase.from("checkins").select("id, guest_name, method, direction, at, by_name, clients(id, name)").gte("at", todayISO()).order("at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const events = (rows ?? []) as unknown as Row[];
  const clients = (clientData ?? []) as { id: string; name: string }[];

  // currently "in" = last event per person is a check-in
  const last = new Map<string, Row>();
  for (const e of [...events].reverse()) {
    const key = e.clients?.id ?? e.guest_name ?? e.id;
    last.set(key, e);
  }
  const insideNow = [...last.values()].filter((e) => e.direction === "in");
  const totalIn = events.filter((e) => e.direction === "in").length;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const stat = (label: string, value: string, color = "var(--teal-dark)") => <StatCard label={label} value={value} color={color} />;

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["checkins"]} />
      <Link href="/dashboard" style={{ color: "var(--teal-dark)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 10 }}>← Dashboard</Link>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Access &amp; Check-in</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Front-desk member entry — biometric · card · manual · QR. Today's activity.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        {stat("Currently inside", String(insideNow.length))}
        {stat("Check-ins today", String(totalIn))}
        {stat("Total events today", String(events.length))}
      </div>

      <CheckinForm clients={clients} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        <div style={{ ...box, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontWeight: 700 }}>Inside now ({insideNow.length})</div>
          {insideNow.length ? insideNow.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderTop: "1px solid var(--border)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
              {e.clients ? <Link href={`/clients/${e.clients.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 600 }}>{e.clients.name}</Link> : (e.guest_name ?? "Guest")}
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{time(e.at)}</span>
            </div>
          )) : <div style={{ padding: "16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>No one checked in.</div>}
        </div>

        <div style={{ ...box, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontWeight: 700 }}>Today's log</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Time</th><th style={th}>Who</th><th style={th}>Dir</th><th style={th}>Method</th><th style={th}>By</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{time(e.at)}</td>
                  <td style={td}>{e.clients ? <Link href={`/clients/${e.clients.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none" }}>{e.clients.name}</Link> : (e.guest_name ?? "Guest")}</td>
                  <td style={td}><span style={{ background: e.direction === "in" ? "var(--green-bg)" : "#eef2f1", color: e.direction === "in" ? "#166534" : "var(--muted)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{e.direction}</span></td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13, textTransform: "capitalize" }}>{e.method}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>{e.by_name ?? "—"}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "20px 16px" }}>No check-ins yet today.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
