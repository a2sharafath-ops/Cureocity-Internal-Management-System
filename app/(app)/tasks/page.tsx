import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import TaskForm from "@/components/TaskForm";
import TaskActions from "@/components/TaskCard";

export const dynamic = "force-dynamic";

type Task = { id: string; title: string; type: string; priority: string; status: string; due_date: string | null; assignee_id: string | null; staff: { name: string } | null; clients: { id: string; name: string } | null };

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "Doing" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export default async function TasksPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/tasks")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: taskData }, { data: staffData }, { data: clientData }] = await Promise.all([
    supabase.from("tasks").select("id, title, type, priority, status, due_date, assignee_id, staff(name), clients(id, name)").order("created_at", { ascending: false }),
    supabase.from("staff").select("id, name").order("name"),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const tasks = (taskData ?? []) as unknown as Task[];
  const staff = (staffData ?? []) as { id: string; name: string }[];
  const clients = (clientData ?? []) as { id: string; name: string }[];

  const today = todayISO();
  const prioColor: Record<string, string> = { High: "var(--red)", Medium: "#b45309", Low: "var(--muted)" };
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["tasks"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Tasks</h1>
        <span style={{ flex: 1 }} />
        <TaskForm staff={staff} clients={clients} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Team work management — deliverables across the centre.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "start" }}>
        {COLUMNS.map((col) => {
          const list = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} style={{ ...box, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <b style={{ fontSize: 13 }}>{col.label}</b>
                <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "0 8px", fontSize: 11, fontWeight: 600 }}>{list.length}</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {list.map((t) => {
                  const overdue = t.status !== "done" && t.due_date && t.due_date < today;
                  return (
                    <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, background: "#fff" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{t.title}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ color: prioColor[t.priority] ?? "var(--muted)", fontSize: 11, fontWeight: 700 }}>{t.priority}</span>
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>· {t.type}</span>
                        {t.due_date && <span style={{ color: overdue ? "var(--red)" : "var(--muted)", fontSize: 11 }}>· {overdue ? "overdue " : ""}{t.due_date.slice(5)}</span>}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>
                        {t.staff?.name ?? "Unassigned"}{t.clients ? <> · <Link href={`/clients/${t.clients.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none" }}>{t.clients.name}</Link></> : ""}
                      </div>
                      <TaskActions id={t.id} status={t.status} />
                    </div>
                  );
                })}
                {list.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12, padding: "6px 2px" }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
