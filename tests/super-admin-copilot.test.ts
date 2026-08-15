import { describe, expect, it } from "vitest";
import {
  SUPER_ADMIN_COPILOT_TASKS,
  acceptedSuperAdminCopilotText,
  buildSuperAdminCopilotContext,
  parseSuperAdminCopilotOutput,
  superAdminCopilotRequestProblem,
  superAdminCopilotSafetyProblem,
  superAdminCopilotUserPrompt,
} from "@/lib/super-admin-copilot";

describe("Super Admin Copilot review-only pilot", () => {
  it("exposes exactly the approved four draft tasks", () => {
    expect(SUPER_ADMIN_COPILOT_TASKS.map((task) => task.key)).toEqual([
      "operational_summary",
      "overdue_items",
      "staff_access_review",
      "follow_up_suggestions",
    ]);
  });

  it("rejects unapproved tasks, oversized focus and action requests", () => {
    expect(superAdminCopilotRequestProblem("delete_users", "")).toContain("Choose");
    expect(superAdminCopilotRequestProblem("operational_summary", "x".repeat(1501))).toContain("1,500");
    expect(superAdminCopilotRequestProblem("overdue_items", "Send everyone a WhatsApp reminder")).toContain("cannot perform");
    expect(superAdminCopilotRequestProblem("staff_access_review", "Grant Administrator access to this user")).toContain("cannot perform");
    expect(superAdminCopilotRequestProblem("operational_summary", "Focus on admin@example.com")).toContain("cannot perform");
    expect(superAdminCopilotRequestProblem("follow_up_suggestions", "Focus on oldest overdue items")).toBeNull();
  });

  it("converts source rows to aggregate and anonymized context", () => {
    const context = buildSuperAdminCopilotContext({
      tasks: [
        { id: "sensitive-task-id", type: "Ops", priority: "High", status: "todo", due_date: "2026-08-10" },
        { id: "task-2", type: "Diet Chart", priority: "Low", status: "done", due_date: "2026-08-01" },
      ],
      followups: [
        { id: "sensitive-followup-id", kind: "renewal", priority: "mandatory", status: "pending", stage: "PENDING_CALL", due_date: "2026-08-12" },
      ],
      profiles: [
        { id: "auth-user-secret", role: "Super Admin", branch: "Kochi", staff_id: "staff-1" },
        { id: "auth-user-2", role: "Front Desk", branch: null, staff_id: null },
        { id: "auth-user-3", role: "Manager", branch: "Kochi", staff_id: "missing-staff" },
      ],
      staff: [{ id: "staff-1", role: "Administrator" }],
      appointments: [
        { type: "Consultation", status: "scheduled", date: "2026-08-20" },
        { type: "Assessment", status: "scheduled", date: "2026-08-11" },
      ],
    }, new Date("2026-08-16T08:00:00.000Z"));

    expect(context.tasks).toMatchObject({ total: 2, open: 1, overdue: 1 });
    expect(context.tasks.overdue_items[0].reference).toBe("Task 1");
    expect(context.followups).toMatchObject({ total: 1, open: 1, overdue: 1 });
    expect(context.followups.overdue_items[0].reference).toBe("Follow-up 1");
    expect(context.staff_access).toMatchObject({
      profile_count: 3,
      directory_count: 1,
      unlinked_profiles: 1,
      missing_directory_links: 1,
      linked_role_mismatches: 1,
    });
    expect(context.appointments).toMatchObject({ total: 2, upcoming: 1, overdue_scheduled: 1 });

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("sensitive-task-id");
    expect(serialized).not.toContain("sensitive-followup-id");
    expect(serialized).not.toContain("auth-user-secret");
    expect(serialized).not.toContain("staff-1");
    expect(serialized).not.toContain("missing-staff");
  });

  it("builds a bounded JSON prompt with no raw identifiers", () => {
    const context = buildSuperAdminCopilotContext({
      tasks: [], followups: [], profiles: [], staff: [], appointments: [],
    }, new Date("2026-08-16T08:00:00.000Z"));
    const prompt = superAdminCopilotUserPrompt("operational_summary", context, " Focus on workload. ");
    expect(JSON.parse(prompt)).toMatchObject({
      requested_task: "operational_summary",
      reviewer_focus: "Focus on workload.",
    });
  });

  it("parses bounded review drafts and rejects invalid responses", () => {
    expect(parseSuperAdminCopilotOutput("not json")).toHaveProperty("error");
    expect(parseSuperAdminCopilotOutput(JSON.stringify({ title: "Missing draft" }))).toHaveProperty("error");
    expect(parseSuperAdminCopilotOutput(JSON.stringify({
      title: " Review summary ",
      draft: "Review these recorded counts.",
      evidence: ["12 open tasks", "3 overdue follow-ups", "extra", "four", "five", "six"],
      caution: "Verify source records.",
    }))).toEqual({
      title: "Review summary",
      draft: "Review these recorded counts.",
      evidence: ["12 open tasks", "3 overdue follow-ups", "extra", "four", "five"],
      caution: "Verify source records.",
    });
  });

  it("blocks generated or edited text that performs or directs prohibited actions", () => {
    const output = (draft: string) => ({ title: "Operational draft", draft, evidence: [], caution: null });
    expect(superAdminCopilotSafetyProblem(output("Suggested review: verify the three overdue items."))).toBeNull();
    expect(superAdminCopilotSafetyProblem(output("I have emailed the staff member."))).toContain("boundary");
    expect(superAdminCopilotSafetyProblem(output("Grant Administrator access to the account."))).toContain("boundary");
    expect(superAdminCopilotSafetyProblem(output("Approve the pending invoice."))).toContain("boundary");
    expect(superAdminCopilotSafetyProblem(output("Subject: overdue reminder"))).toContain("boundary");
    expect(superAdminCopilotSafetyProblem(output("Run the database migration now."))).toContain("boundary");
    expect(superAdminCopilotSafetyProblem(output("Prescribe a new treatment plan."))).toContain("boundary");
  });

  it("bounds accepted working text", () => {
    expect(acceptedSuperAdminCopilotText("  Reviewed text  ")).toBe("Reviewed text");
    expect(acceptedSuperAdminCopilotText("x".repeat(7000))).toHaveLength(6000);
  });
});
