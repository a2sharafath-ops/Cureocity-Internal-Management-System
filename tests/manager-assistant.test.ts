import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import { MANAGER_WORKFLOWS, buildManagerOperationsDraft, managerWorkflowProblem } from "@/lib/manager-assistant";

describe("Manager operations checklist Assistant", () => {
  it("offers only the four approved static workflow choices", () => {
    expect(MANAGER_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "coverage_coordination", "coach_quality_review", "onboarding_handover", "service_operations_review",
    ]);
    expect(managerWorkflowProblem("coverage_coordination")).toBeNull();
    expect(managerWorkflowProblem("assign_staff")).toContain("approved Manager operations workflow");
  });

  it("uses only existing Manager-visible routes that ordinary Staff cannot access", () => {
    for (const workflow of MANAGER_WORKFLOWS) {
      for (const destination of workflow.destinations) {
        expect(canSee("Manager", destination.href), `${workflow.key}:${destination.href}`).toBe(true);
        expect(canSee("Staff", destination.href), `${workflow.key}:${destination.href}`).toBe(false);
      }
    }
  });

  it("builds deterministic evidence-linked guidance without record context", () => {
    const result = buildManagerOperationsDraft("coverage_coordination");
    expect(result).toMatchObject({
      policyVersion: "2026-08-17.1",
      taskVersion: "manager.operations_checklist.v1",
      title: "Coverage coordination checklist",
      context: { role: "Manager", workflowKey: "coverage_coordination" },
    });
    expect(result.context.destinations.map((item) => item.href)).toEqual(["/appointments", "/sessions", "/followups"]);
    expect(result.evidence).toHaveLength(3);
    expect(result.caution).toContain("No client, clinical, coach, appointment, session, finance, HR, staff, access, message or other application record was read");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|staff_id|appointment_id|session_id|email|phone|amount|record_id/i);
  });

  it("has no free-text request, external AI, or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/manager-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/ManagerAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|staff|appointments|sessions|followups|packages|services|tasks|coach_assessments)["']\)/);
    expect(action).toContain('.rpc("create_manager_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
