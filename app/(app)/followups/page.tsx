import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { generateFollowups } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import FollowupActions from "@/components/FollowupActions";

export const dynamic = "force-dynamic";

type Fu = { id: string; kind: string; label: string; due_date: string; priority: string; status: string; clients: { id: string; name: string } | null };

export default async function FollowupsPage({ searchParams }: { searchParams: { view?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/followups")) redirect("/dashboard");

  const view = searchParams.view === "done" ? "done" : "open";
  const today = todayISO();
  const supabase = createClient();
  let query = supabase.from("followups").select("id, kind, label, due_date, priority, status, clients(id, name)").order("due_date");
  query = view === "done" ? query.neq("status", "pending").limit(100) : query.eq("status", "pending");
  const { data } = await query;
  const items = (data ?? []) as unknown as Fu[];

  const overdue = items.filter((f) => f.status === "pending" && f.due_date < today);
  const dueToday = items.filter((f) => f.status === "pending" && f.due_date === today);
  const upcoming = items.filter((f) => f.status === "pending" && f.due_date > today);
  const mandatoryToday = dueToday.filter((f) => f.priority === "mandatory").length;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const stat = (label: string, value: string, color = "var(--teal-dark)") => (
    <div style={{ ...box, padding: "14px 16px", flex: 1 }}><div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div></div>
  );
  const kindChip = (f: Fu) => {
    const map: Record<string, [string, string]> = { onboarding: ["#e0f2f1", "var(--teal-dark)"], renewal: ["var(--amber-bg)", "#b45309"], custom: ["#eef2f1", "var(--muted)"] };
    const [bg, c] = map[f.kind] ?? ["#eef2f1", "var(--muted)"];
    return <span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{f.kind}</span>;
  };
  const tab = (key: string, label: string) => (
    <Link href={`/followups?view=${key}`} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: "none", background: view === key ? "var(--teal)" : "#fff", color: view === key ? "#fff" : "var(--muted)", border: "1px solid var(--border)" }}>{label}</Link>
  );

  const rows = (list: Fu[], emptyText: string) => (
    <div style={{ ...box, overflow: "hidden", marginBottom: 20 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {list.map((f) => (
            <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...td, width: 96, color: f.due_date < today && f.status === "pending" ? "var(--red)" : "var(--muted)", fontSize: 13 }}>{f.due_date.slice(5)}</td>
              <td style={td}>{f.clients ? <Link href={`/clients/${f.clients.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 600 }}>{f.clients.name}</Link> : "—"}</td>
              <td style={td}>{f.label} {f.priority === "mandatory" && <span style={{ background: "#fee2e2", color: "var(--red)", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>mandatory</span>}</td>
              <td style={td}>{kindChip(f)}</td>
              <td style={{ ...td, textAlign: "right" }}>{view === "open" ? <FollowupActions id={f.id} /> : <span style={{ color: "var(--muted)", fontSize: 12 }}>{f.status}</span>}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "18px 16px" }}>{emptyText}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["followups"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Follow-ups</h1>
        <span style={{ flex: 1 }} />
        {tab("open", "Open")}{tab("done", "Handled")}
        <form action={generateFollowups}>
          <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Generate due</button>
        </form>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Onboarding touchpoints (Day 2 / 10 / 21 / 28) &amp; renewal nudges — the front-desk call queue.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        {stat("Overdue", String(overdue.length), overdue.length ? "var(--red)" : "var(--teal-dark)")}
        {stat("Due today", String(dueToday.length))}
        {stat("Mandatory today", String(mandatoryToday), mandatoryToday ? "#b45309" : "var(--teal-dark)")}
        {stat("Upcoming", String(upcoming.length))}
      </div>

      {view === "open" ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", margin: "0 0 6px" }}>🔥 Overdue</div>
          {rows(overdue, "Nothing overdue 🎉")}
          <div style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>📌 Due today</div>
          {rows(dueToday, "Nothing due today")}
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "0 0 6px" }}>Upcoming</div>
          {rows(upcoming.slice(0, 30), "Nothing upcoming. Click “Generate due” to build the queue.")}
        </>
      ) : rows(items, "Nothing handled yet.")}
    </div>
  );
}
