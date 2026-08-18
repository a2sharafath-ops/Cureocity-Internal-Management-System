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
import TaskProjectForm from "@/components/TaskProjectForm";
import TaskProjectTools from "@/components/TaskProjectTools";

type TaskAssignee = { task_id: string; staff_id: string; staff: { name: string } | null };
type Raw = { id: string; title: string; type: string; priority: string; status: string; due_date: string | null; assignee_id: string | null; project_id: string | null; staff: { name: string } | null; clients: { id: string; name: string } | null; leads: { id: string; name: string } | null };
type Project = { id: string; name: string; status: string; due_date: string | null; owner_id: string | null; staff: { name: string } | null };

export default async function TasksPageContent() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/tasks")) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: taskData }, { data: sharedAssignmentData }, { data: staffData }, { data: clientData }, { data: contactData, error: contactError }, { data: projectData, error: projectError }] = await Promise.all([
    // `tasks` now has both a legacy assignee link and the shared-assignee join
    // table. Name the legacy relationship explicitly so PostgREST does not
    // mistake the two valid paths for an error and render a false zero-task view.
    supabase.from("tasks").select("id, title, type, priority, status, due_date, assignee_id, project_id, staff:staff!tasks_assignee_id_fkey(name), clients(id, name), leads(id, name)").order("created_at", { ascending: false }),
    // Migration 0200 adds this table. A missing table must not hide existing
    // tasks while a deployment is waiting for its database migration.
    supabase.from("task_assignees").select("task_id, staff_id, staff:staff!task_assignees_staff_id_fkey(name)"),
    supabase.from("staff").select("id, name").order("name"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("staff").select("id, task_reminder_phone, task_reminder_whatsapp_opt_in"),
    supabase.from("task_projects").select("id, name, status, due_date, owner_id, staff:owner_id(name)").order("created_at", { ascending: false }),
  ]);
  const raw = (taskData ?? []) as unknown as Raw[];
  const staff = (staffData ?? []) as { id: string; name: string }[];
  const contacts = new Map(((contactData ?? []) as { id: string; task_reminder_phone: string | null; task_reminder_whatsapp_opt_in: boolean | null }[]).map((row) => [row.id, row]));
  const clients = (clientData ?? []) as { id: string; name: string }[];
  // Completed projects are retained as history, but should not remain in the
  // active project dashboard or assignment controls.
  const projects = projectError ? [] : ((projectData ?? []) as unknown as Project[]).filter((project) => project.status !== "completed");
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const sharedByTask = new Map<string, { id: string; name: string }[]>();
  for (const row of (sharedAssignmentData ?? []) as unknown as TaskAssignee[]) {
    if (!row.staff?.name) continue;
    sharedByTask.set(row.task_id, [...(sharedByTask.get(row.task_id) ?? []), { id: row.staff_id, name: row.staff.name }]);
  }
  const tasks: TaskRow[] = raw.map((t) => {
    const shared = sharedByTask.get(t.id) ?? [];
    const fallback = t.assignee_id && t.staff?.name ? [{ id: t.assignee_id, name: t.staff.name }] : [];
    const assignees = shared.length ? shared : fallback;
    return {
    id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status, due_date: t.due_date,
    assigneeId: t.assignee_id, assignee: assignees.map((row) => row.name).join(", ") || null, assigneeIds: assignees.map((row) => row.id), assignees: assignees.map((row) => row.name), clientId: t.clients?.id ?? null, clientName: t.clients?.name ?? null,
    projectId: t.project_id, projectName: t.project_id ? projectById.get(t.project_id)?.name ?? null : null,
    leadId: t.leads?.id ?? null, leadName: t.leads?.name ?? null,
  }; });
  const staffNames = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean) as string[]));
  const types = Array.from(new Set(tasks.map((t) => t.type).filter(Boolean)));

  return <div style={{ maxWidth: 1220 }}>
    <RealtimeRefresh tables={projectError ? ["tasks", "task_assignees"] : ["tasks", "task_projects", "task_assignees"]} />
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
      <div><h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Tasks</h1><p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Work management — deliverables, tabs &amp; smart filters</p></div>
      <span style={{ flex: 1 }} />
      {canManageTasks(me.role) && !projectError && <TaskProjectForm staff={staff} />}
      {canManageTasks(me.role) && !projectError && <TaskProjectTools hasProjects={projects.length > 0} />}
      {canManageTasks(me.role) && <TaskForm staff={staff} clients={clients} projects={projects.map(({ id, name }) => ({ id, name }))} />}
      {canManageTasks(me.role) && <TaskReminderContacts available={!contactError} staff={staff.map((person) => {
        const contact = contacts.get(person.id);
        return { id: person.id, name: person.name, phone: contact?.task_reminder_phone ?? null, optedIn: Boolean(contact?.task_reminder_whatsapp_opt_in) };
      })} />}
    </div>
    {canManageTasks(me.role) && <TaskBulkImport projects={projects.map(({ id, name }) => ({ id, name }))} />}
    <TasksView tasks={tasks} today={todayISO()} staff={staffNames} staffOptions={staff} types={types} projects={projects.map(({ id, name, status, due_date, staff }) => ({ id, name, status, dueDate: due_date, owner: staff?.name ?? null }))} currentStaffId={me.staffId ?? null} />
  </div>;
}
