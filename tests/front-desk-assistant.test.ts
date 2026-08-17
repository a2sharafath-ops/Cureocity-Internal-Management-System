import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import {
  FRONT_DESK_WORKFLOWS,
  buildFrontDeskOperationalDraft,
  frontDeskWorkflowProblem,
} from "@/lib/front-desk-assistant";

describe("Front Desk operational checklist Assistant", () => {
  it("offers only the four approved static workflow choices", () => {
    expect(FRONT_DESK_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "lead_intake",
      "client_onboarding",
      "appointment_coordination",
      "follow_up_queue",
    ]);
    expect(frontDeskWorkflowProblem("lead_intake")).toBeNull();
    expect(frontDeskWorkflowProblem("payment_refund")).toContain("approved Front Desk workflow");
  });

  it("uses routes already visible to the real Front Desk role", () => {
    for (const workflow of FRONT_DESK_WORKFLOWS) {
      for (const destination of workflow.destinations) {
        expect(canSee("Front Desk", destination.href), `${workflow.key}:${destination.href}`).toBe(true);
        expect(canSee("Staff", destination.href), `${workflow.key}:${destination.href}`).toBe(false);
      }
    }
  });

  it("builds a deterministic evidence-linked checklist without record context", () => {
    const result = buildFrontDeskOperationalDraft("appointment_coordination");
    expect(result).toMatchObject({
      policyVersion: "2026-08-17.1",
      taskVersion: "front_desk.operational_checklist.v1",
      title: "Appointment coordination navigation checklist",
      context: { role: "Front Desk", workflowKey: "appointment_coordination" },
    });
    expect(result.context.destinations.map((item) => item.href)).toEqual(["/appointments", "/sessions"]);
    expect(result.evidence).toHaveLength(2);
    expect(result.caution).toContain("No client, clinical, finance, HR, staff, appointment or message record was read");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|appointment_id|email|phone|name|staff_id/i);
  });

  it("has no free-text request, external AI, or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/front-desk-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/FrontDeskAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|staff|appointments|invoices|tasks|followups|leads)["']\)/);
    expect(action).toContain('.rpc("create_front_desk_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
