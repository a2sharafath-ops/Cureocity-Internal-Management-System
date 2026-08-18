import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canManageTasks } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import TaskForm from "@/components/TaskForm";
import TaskBulkImport from "@/components/TaskBulkImport";
import TasksView, { type TaskRow } from "@/components/TasksView";
import TaskReminderContacts from "@/components/TaskReminderContacts";

export const dynamic = "force-dynamic";

type Raw = { id: string; title: string; type: string; priority: string; status: string; due_date: string | null; assignee_id: string | null; staff: { name: string } | null; clients: { id: string; name: string } | null; leads: { id: string; name: string } | null };

export default async function TasksPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/tasks")) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: taskData }, { data: staffData }, { data: clientData }, { data: contactData, error: contactError }] = await Promise.all([
    supabase.from("tasks").select("id, title, type, priority, status, due_date, assignee_id, staff(name), clients(id, name), leads(id, name)").order("created_at", { ascending: false }),
    supabase.from("staff").select("id, name").order("name"),
    supabase.from("clients").select("id, name").order("name"),
    // 0197 may not be installed yet on a deployed environment. Keep the core
    // task board usable until the contact-preference migration is applied.
    supabase.from("staff").select("id, task_reminder_phone, task_reminder_whatsapp_opt_in"),
  ]);
  const raw = (taskData ?? []) as unknown as Raw[];
  const staff = (staffData ?? []) as { id: string; name: string }[];
  const contacts = new Map(((contactData ?? []) as { id: string; task_reminder_phone: string | null; task_reminder_whatsapp_opt_in: boolean | null }[]).map((row) => [row.id, row]));
  const clients = (clientData ?? []) as { id: string; name: string }[];

  const tasks: TaskRow[] = raw.map((t) => ({
    id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status, due_date: t.due_date,
    assigneeId: t.assignee_id, assignee: t.staff?.name ?? null, clientId: t.clients?.id ?? null, clientName: t.clients?.name ?? null,
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
        {canManageTasks(me.role) && <TaskReminderContacts available={!contactError} staff={staff.map((person) => {
          const contact = contacts.get(person.id);
          return { id: person.id, name: person.name, phone: contact?.task_reminder_phone ?? null, optedIn: Boolean(contact?.task_reminder_whatsapp_opt_in) };
        })} />}
      </div>

      {canManageTasks(me.role) && <TaskBulkImport />}

      <TasksView tasks={tasks} today={todayISO()} staff={staffNames} types={types} currentStaffId={me.staffId ?? null} />
    </div>
  );
}
