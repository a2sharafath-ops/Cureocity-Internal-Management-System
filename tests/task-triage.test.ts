import { describe, expect, it } from "vitest";
import { taskTriage } from "@/lib/task-triage";

describe("task triage", () => {
  it("separates open, overdue, blocked, unassigned and personal work", () => {
    expect(taskTriage([
      { id: "1", status: "todo", dueDate: "2026-08-18", assigneeId: "me" },
      { id: "2", status: "blocked", dueDate: "2026-08-17", assigneeId: null },
      { id: "3", status: "done", dueDate: "2026-08-10", assigneeId: "me" },
      { id: "4", status: "doing", dueDate: null, assigneeId: "other" },
    ], "2026-08-18", "me")).toEqual({ open: 3, overdue: 1, blocked: 1, unassigned: 1, mine: 1 });
  });
});
