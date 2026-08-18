import { notifyRoles, notifyStaff } from "@/lib/notify";
import { sendTemplate, watiReadiness } from "@/lib/wati";

type AnyClient = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type TaskReminderResult = { scanned: number; inApp: number; whatsapp: number; escalated: number; operationsDigest: number; skipped: boolean };

const MANAGEMENT = ["Administrator", "Manager", "Super Admin"];
const PROTOCOL = "task_reminders";

export function taskReminderPlan(dueDate: string, today: string) {
  const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000);
  if (elapsed === 0) return { kind: "due_today", gate: `due:${dueDate}`, label: "due today", whatsapp: true, escalate: false };
  // Remind the owner on day 1, 3 and 7, then once each following week. This
  // is intentionally sparse: notifications should bring work back into view,
  // not turn into a daily stream people learn to ignore.
  if (elapsed > 0 && (elapsed === 1 || elapsed === 3 || elapsed === 7 || (elapsed > 7 && elapsed % 7 === 0))) {
    return { kind: "overdue", gate: `overdue:${elapsed}`, label: `${elapsed} day${elapsed === 1 ? "" : "s"} overdue`, whatsapp: elapsed === 1, escalate: elapsed >= 3 };
  }
  return null;
}

function whatsappEnabled() {
  return process.env.TASK_REMINDERS_WHATSAPP_ENABLED === "true"
    && Boolean(process.env.WATI_TEMPLATE_STAFF_TASK_REMINDER)
    && watiReadiness().ready;
}

function operationsDigestEnabled() {
  return process.env.TASK_REMINDERS_ENABLED === "true"
    && process.env.TASK_OPERATIONS_DIGEST_WHATSAPP_ENABLED === "true"
    && Boolean(process.env.WATI_TEMPLATE_TASK_OPERATIONS_DIGEST)
    && watiReadiness().ready;
}

export type OperationsTask = { status: string; assigneeId: string | null };

/** A short, non-sensitive count summary for a manager's own operating scope. */
export function taskOperationsSummary(tasks: OperationsTask[]) {
  const open = tasks.filter((task) => task.status !== "done");
  return {
    open: open.length,
    overdue: 0, // due-date treatment is added by the cron's scoped query below
    blocked: open.filter((task) => task.status === "blocked").length,
    unassigned: open.filter((task) => !task.assigneeId).length,
  };
}

async function sendOperationsDigests(supabase: AnyClient, today: string): Promise<number> {
  if (!operationsDigestEnabled()) return 0;
  const [{ data: profileRows }, { data: taskRows }, { data: staffRows }] = await Promise.all([
    supabase.from("profiles").select("role, staff_id, branch").in("role", ["Super Admin", "Administrator", "Manager"]).not("staff_id", "is", null),
    supabase.from("tasks").select("id, status, due_date, assignee_id").neq("status", "done"),
    supabase.from("staff").select("id, name, branch, task_reminder_phone, task_reminder_whatsapp_opt_in"),
  ]);
  const staff = (staffRows ?? []) as { id: string; name: string; branch: string | null; task_reminder_phone: string | null; task_reminder_whatsapp_opt_in: boolean | null }[];
  const staffById = new Map(staff.map((row) => [row.id, row]));
  const recipients = (profileRows ?? []) as { role: string; staff_id: string; branch: string | null }[];
  const tasks = (taskRows ?? []) as { id: string; status: string; due_date: string | null; assignee_id: string | null }[];
  const recipientIds = recipients.map((recipient) => recipient.staff_id);
  if (!recipientIds.length || !tasks.length) return 0;
  const { data: seenRows } = await supabase.from("automation_events")
    .select("subject_id").eq("protocol", PROTOCOL).eq("gate", `ops-digest:${today}`).eq("kind", "operations_whatsapp").in("subject_id", recipientIds);
  const seen = new Set(((seenRows ?? []) as { subject_id: string }[]).map((row) => row.subject_id));
  const events: { subject_id: string; subject_kind: string; protocol: string; gate: string; kind: string; due_at: string }[] = [];
  let sent = 0;

  for (const recipient of recipients) {
    const person = staffById.get(recipient.staff_id);
    if (!person?.task_reminder_whatsapp_opt_in || !person.task_reminder_phone || seen.has(recipient.staff_id)) continue;
    // A configured branch is the reliable team boundary. Super Admin always
    // receives the all-operations summary. An Admin without a branch also
    // receives all operations; a Manager without a branch receives only their
    // directly assigned work, never an assumed organisation-wide view.
    const scoped = recipient.role === "Super Admin"
      ? tasks
      : recipient.branch
        ? tasks.filter((task) => task.assignee_id && staffById.get(task.assignee_id)?.branch === recipient.branch)
        : recipient.role === "Administrator"
          ? tasks
          : tasks.filter((task) => task.assignee_id === recipient.staff_id);
    const summary = taskOperationsSummary(scoped.map((task) => ({ status: task.status, assigneeId: task.assignee_id })));
    const overdue = scoped.filter((task) => Boolean(task.due_date && task.due_date < today)).length;
    if (!summary.open) continue;
    const compact = `${summary.open} open · ${overdue} overdue · ${summary.blocked} blocked · ${summary.unassigned} unassigned`;
    const result = await sendTemplate({
      phone: person.task_reminder_phone,
      template: { name: String(process.env.WATI_TEMPLATE_TASK_OPERATIONS_DIGEST), params: [person.name.split(/\s+/)[0] || "there", compact] },
    });
    if (!result.ok) continue;
    events.push({ subject_id: recipient.staff_id, subject_kind: "staff", protocol: PROTOCOL, gate: `ops-digest:${today}`, kind: "operations_whatsapp", due_at: `${today}T00:00:00Z` });
    sent++;
  }
  if (events.length) await supabase.from("automation_events").upsert(events, { onConflict: "subject_id,protocol,gate,kind", ignoreDuplicates: true });
  return sent;
}

/**
 * Staff-only operational task reminders.  It is fully disabled unless the
 * explicit runtime switch is enabled.  WhatsApp copies are generic by design:
 * no client name, task title, clinical detail, or link token leaves Cureocity.
 */
export async function runTaskReminders(supabase: AnyClient, today: string): Promise<TaskReminderResult> {
  if (process.env.TASK_REMINDERS_ENABLED !== "true") return { scanned: 0, inApp: 0, whatsapp: 0, escalated: 0, operationsDigest: 0, skipped: true };

  const { data } = await supabase.from("tasks")
    .select("id, title, due_date, assignee_id, staff:assignee_id(id, name, task_reminder_phone, task_reminder_whatsapp_opt_in)")
    .neq("status", "done").not("due_date", "is", null).lte("due_date", today);
  const tasks = (data ?? []) as {
    id: string; title: string; due_date: string; assignee_id: string | null;
    staff: { id: string; name: string; task_reminder_phone: string | null; task_reminder_whatsapp_opt_in: boolean | null } | null;
  }[];
  if (!tasks.length) return { scanned: 0, inApp: 0, whatsapp: 0, escalated: 0, operationsDigest: await sendOperationsDigests(supabase, today), skipped: false };

  const { data: seenRows } = await supabase.from("automation_events")
    .select("subject_id, gate, kind").eq("protocol", PROTOCOL).in("subject_id", tasks.map((task) => task.id));
  const seen = new Set(((seenRows ?? []) as { subject_id: string; gate: string; kind: string }[]).map((r) => `${r.subject_id}|${r.gate}|${r.kind}`));
  const events: { subject_id: string; subject_kind: string; protocol: string; gate: string; kind: string; due_at: string }[] = [];
  let inApp = 0, whatsapp = 0, escalated = 0;

  for (const task of tasks) {
    const plan = taskReminderPlan(task.due_date, today);
    if (!plan || !task.assignee_id) continue;
    const base = `${task.id}|${plan.gate}`;
    const message = { title: `Task ${plan.label}`, body: task.title, href: "/tasks", icon: plan.kind === "overdue" ? "🔴" : "⏰" };
    if (!seen.has(`${base}|in_app`) && await notifyStaff(supabase, task.assignee_id, message)) {
      events.push({ subject_id: task.id, subject_kind: "task", protocol: PROTOCOL, gate: plan.gate, kind: "in_app", due_at: `${task.due_date}T00:00:00Z` });
      inApp++;
    }
    if (plan.escalate && !seen.has(`${base}|management`)) {
      await notifyRoles(supabase, MANAGEMENT, { ...message, title: `Task needs attention — ${plan.label}`, body: task.title, icon: "⚠️" });
      events.push({ subject_id: task.id, subject_kind: "task", protocol: PROTOCOL, gate: plan.gate, kind: "management", due_at: `${task.due_date}T00:00:00Z` });
      escalated++;
    }
    const staff = task.staff;
    if (plan.whatsapp && staff?.task_reminder_whatsapp_opt_in && staff.task_reminder_phone && whatsappEnabled() && !seen.has(`${base}|whatsapp`)) {
      // Template only receives the staff member's first name and a neutral
      // timing label. It never carries task/client information.
      const result = await sendTemplate({
        phone: staff.task_reminder_phone,
        template: { name: String(process.env.WATI_TEMPLATE_STAFF_TASK_REMINDER), params: [staff.name.split(/\s+/)[0] || "there", plan.label] },
      });
      if (result.ok) {
        events.push({ subject_id: task.id, subject_kind: "task", protocol: PROTOCOL, gate: plan.gate, kind: "whatsapp", due_at: `${task.due_date}T00:00:00Z` });
        whatsapp++;
      }
    }
  }
  if (events.length) await supabase.from("automation_events").upsert(events, { onConflict: "subject_id,protocol,gate,kind", ignoreDuplicates: true });
  return { scanned: tasks.length, inApp, whatsapp, escalated, operationsDigest: await sendOperationsDigests(supabase, today), skipped: false };
}
