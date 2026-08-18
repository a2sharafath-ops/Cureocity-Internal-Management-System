import { notifyRoles, notifyStaff } from "@/lib/notify";
import { sendTemplate, watiReadiness } from "@/lib/wati";

type AnyClient = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type TaskReminderResult = { scanned: number; inApp: number; whatsapp: number; escalated: number; skipped: boolean };

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

/**
 * Staff-only operational task reminders.  It is fully disabled unless the
 * explicit runtime switch is enabled.  WhatsApp copies are generic by design:
 * no client name, task title, clinical detail, or link token leaves Cureocity.
 */
export async function runTaskReminders(supabase: AnyClient, today: string): Promise<TaskReminderResult> {
  if (process.env.TASK_REMINDERS_ENABLED !== "true") return { scanned: 0, inApp: 0, whatsapp: 0, escalated: 0, skipped: true };

  const { data } = await supabase.from("tasks")
    .select("id, title, due_date, assignee_id, staff:assignee_id(id, name, task_reminder_phone, task_reminder_whatsapp_opt_in)")
    .neq("status", "done").not("due_date", "is", null).lte("due_date", today);
  const tasks = (data ?? []) as {
    id: string; title: string; due_date: string; assignee_id: string | null;
    staff: { id: string; name: string; task_reminder_phone: string | null; task_reminder_whatsapp_opt_in: boolean | null } | null;
  }[];
  if (!tasks.length) return { scanned: 0, inApp: 0, whatsapp: 0, escalated: 0, skipped: false };

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
  return { scanned: tasks.length, inApp, whatsapp, escalated, skipped: false };
}
