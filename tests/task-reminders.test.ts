import { describe, expect, it } from "vitest";
import { taskOperationsProjectSummary, taskOperationsSummary, taskReminderPlan } from "@/lib/cron/task-reminders";

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

describe("operations digest summary", () => {
  it("contains only operational counts, excluding completed tasks", () => {
    expect(taskOperationsSummary([
      { status: "todo", assigneeId: "one" },
      { status: "blocked", assigneeId: "one" },
      { status: "doing", assigneeId: null },
      { status: "done", assigneeId: null },
    ])).toEqual({ open: 3, overdue: 0, blocked: 1, unassigned: 1 });
  });

  it("includes compact project health without task or client details", () => {
    const summary = taskOperationsProjectSummary([
      { status: "todo", assigneeId: "one", dueDate: "2026-08-18", projectName: "ORB App Launch Event" },
      { status: "blocked", assigneeId: "one", dueDate: "2026-08-17", projectName: "ORB App Launch Event" },
      { status: "doing", assigneeId: "two", dueDate: "2026-08-20", projectName: "Marketing & Media" },
      { status: "done", assigneeId: "two", dueDate: "2026-08-17", projectName: "Marketing & Media" },
    ], "2026-08-18");
    expect(summary).toBe("ORB App Launch Event: 2 open / 1 overdue / 1 blocked; Marketing & Media: 1 open");
  });
});
