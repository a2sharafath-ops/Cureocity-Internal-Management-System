import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import {
  ADMINISTRATOR_WORKFLOWS,
  administratorWorkflowProblem,
  buildAdministratorGovernanceDraft,
} from "@/lib/administrator-assistant";

describe("Administrator governance checklist Assistant", () => {
  it("offers only the four approved static workflow choices", () => {
    expect(ADMINISTRATOR_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "access_governance",
      "issue_governance",
      "service_configuration_review",
      "operational_oversight",
    ]);
    expect(administratorWorkflowProblem("access_governance")).toBeNull();
    expect(administratorWorkflowProblem("grant_access")).toContain("approved Administrator governance workflow");
  });

  it("uses only existing Administrator-visible routes that ordinary Staff cannot access", () => {
    for (const workflow of ADMINISTRATOR_WORKFLOWS) {
      for (const destination of workflow.destinations) {
        expect(canSee("Administrator", destination.href), `${workflow.key}:${destination.href}`).toBe(true);
        expect(canSee("Staff", destination.href), `${workflow.key}:${destination.href}`).toBe(false);
      }
    }
  });

  it("builds a deterministic evidence-linked checklist without record context", () => {
    const result = buildAdministratorGovernanceDraft("access_governance");
    expect(result).toMatchObject({
      policyVersion: "2026-08-17.1",
      taskVersion: "administrator.governance_checklist.v1",
      title: "Access governance checklist",
      context: { role: "Administrator", workflowKey: "access_governance" },
    });
    expect(result.context.destinations.map((item) => item.href)).toEqual(["/users", "/audit", "/compliance"]);
    expect(result.evidence).toHaveLength(3);
    expect(result.caution).toContain("No client, clinical, finance, HR, staff, access, issue, message or other application record was read");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|staff_id|issue_id|email|phone|amount|record_id/i);
  });

  it("has no free-text request, external AI, or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/administrator-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/AdministratorAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|staff|appointments|issues|packages|services|followups|retention|audit_log)["']\)/);
    expect(action).toContain('.rpc("create_administrator_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
