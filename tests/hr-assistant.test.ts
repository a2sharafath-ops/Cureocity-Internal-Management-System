import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import { HR_WORKFLOWS, buildHrProcessDraft, hrWorkflowProblem } from "@/lib/hr-assistant";

describe("HR process-checklist Assistant", () => {
  it("offers only the four approved static HR workflows", () => {
    expect(HR_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "onboarding_offboarding_process", "attendance_leave_process", "training_policy_guidance", "capacity_privacy_review",
    ]);
    expect(hrWorkflowProblem("onboarding_offboarding_process")).toBeNull();
    expect(hrWorkflowProblem("approve_leave")).toContain("approved HR process");
  });

  it("uses only existing HR-visible destinations", () => {
    for (const workflow of HR_WORKFLOWS) for (const destination of workflow.destinations) {
      const url = new URL(destination.href, "https://cureocity.test");
      expect(canSee("HR", url.pathname), destination.href).toBe(true);
    }
  });

  it("builds deterministic guidance with privacy and employment hard stops", () => {
    const result = buildHrProcessDraft("capacity_privacy_review");
    expect(result).toMatchObject({ policyVersion: "2026-08-17.1", taskVersion: "hr.process_checklist.v1", title: "Capacity and privacy review checklist", context: { role: "HR", workflowKey: "capacity_privacy_review" } });
    expect(result.draft).toContain("Do not rank individuals");
    expect(result.draft).toContain("cannot confirm that anything exists");
    expect(result.caution).toContain("No staff, attendance, leave");
    expect(JSON.stringify(result.context)).not.toMatch(/staff_id|employee_id|leave_id|attendance_id|email|phone|salary|government_id|record_id/i);
  });

  it("has no free-text, AI, HR-record read, or HR action path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/hr-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/HrAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:staff|profiles|attendance|leaves|leave_requests|rosters|payroll|salary_structures|employees|recruitment|onboarding|offboarding|documents|messages)["']\)/);
    expect(action).toContain('.rpc("create_hr_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(action).not.toMatch(/approveLeave|rejectLeave|markAttendance|createStaff|updateSalary|completeOnboarding|offboard|inviteStaff/i);
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
