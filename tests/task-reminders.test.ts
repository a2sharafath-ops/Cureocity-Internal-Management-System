import { describe, expect, it } from "vitest";
import { taskReminderPlan } from "@/lib/cron/task-reminders";

describe("task reminder cadence", () => {
  it("notifies on the due date and only on measured overdue intervals", () => {
    expect(taskReminderPlan("2026-08-18", "2026-08-18")).toMatchObject({ kind: "due_today", whatsapp: true, escalate: false });
    expect(taskReminderPlan("2026-08-17", "2026-08-18")).toMatchObject({ kind: "overdue", whatsapp: true, escalate: false });
    expect(taskReminderPlan("2026-08-16", "2026-08-18")).toBeNull();
    expect(taskReminderPlan("2026-08-15", "2026-08-18")).toMatchObject({ kind: "overdue", whatsapp: false, escalate: true });
    expect(taskReminderPlan("2026-08-11", "2026-08-18")).toMatchObject({ kind: "overdue", escalate: true });
  });

  it("does not create a reminder before a task is due", () => {
    expect(taskReminderPlan("2026-08-19", "2026-08-18")).toBeNull();
  });
});
