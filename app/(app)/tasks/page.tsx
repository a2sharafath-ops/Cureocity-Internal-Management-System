import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canManageTasks } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import TaskForm from "@/components/TaskForm";
import TasksView, { type TaskRow } from "@/components/TasksView";

export const dynamic = "force-dynamic";

type Raw = { id: string; title: string; type: string; priority: string; status: string; due_date: string | null; assignee_id: string | null; staff: { name: string } | null; clients: { id: string; name: string } | null; leads: { id: string; name: string } | null };

export default async function TasksPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/tasks")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: taskData }, { data: staffData }, { data: clientData }] = await Promise.all([
    supabase.from("tasks").select("id, title, type, priority, status, due_date, assignee_id, staff(name), clients(id, name), leads(id, name)").order("created_at", { ascending: false }),
    supabase.from("staff").select("id, name").order("name"),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const raw = (taskData ?? []) as unknown as Raw[];
  const staff = (staffData ?? []) as { id: string; name: string }[];
  const clients = (clientData ?? []) as { id: string; name: string }[];

  const tasks: TaskRow[] = raw.map((t) => ({
    id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status, due_date: t.due_date,
    assignee: t.staff?.name ?? null, clientId: t.clients?.id ?? null, clientName: t.clients?.name ?? null,
    // A task can belong to a lead instead of a client (0085). Without this the
    // auto-created "call this new lead" task would show a dash in the Client
    // column with no way back to the record it's about.
    leadId: t.leads?.id ?? null, leadName: t.leads?.name ?? null,
  }));
  const staffNames = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean) as string[]));
  const types = Array.from(new Set(tasks.map((t) => t.type).filter(Boolean)));

  return (
    <div style={{ maxWidth: 1220 }}>
      <RealtimeRefresh tables={["tasks"]} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Tasks</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Work management — deliverables, tabs &amp; smart filters</p>
        </div>
        <span style={{ flex: 1 }} />
        {canManageTasks(me.role) && <TaskForm staff={staff} clients={clients} />}
      </div>

      <TasksView tasks={tasks} today={todayISO()} staff={staffNames} types={types} />
    </div>
  );
}
