import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import { WS_TABS, visibleWorkspaces, type WsRoleKey } from "@/lib/workspaces";
import { MEDICAL_DIRECTOR_WORKFLOWS, buildMedicalDirectorReviewDraft, medicalDirectorWorkflowProblem } from "@/lib/medical-director-assistant";

describe("Medical Director review-checklist Assistant", () => {
  it("offers only the four approved static review workflows", () => {
    expect(MEDICAL_DIRECTOR_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "review_queue_orientation", "evidence_completeness_review", "safety_escalation_governance", "cross_discipline_governance",
    ]);
    expect(medicalDirectorWorkflowProblem("evidence_completeness_review")).toBeNull();
    expect(medicalDirectorWorkflowProblem("approve_diet_chart")).toContain("approved Medical Director review workflow");
  });

  it("uses only existing Medical Director-visible destinations", () => {
    const workspaces = new Set(visibleWorkspaces("Medical Director"));
    for (const workflow of MEDICAL_DIRECTOR_WORKFLOWS) for (const destination of workflow.destinations) {
      const url = new URL(destination.href, "https://cureocity.test");
      expect(canSee("Medical Director", url.pathname), destination.href).toBe(true);
      if (url.pathname === "/workspace") {
        const role = (url.searchParams.get("role") ?? "doctor") as WsRoleKey;
        const tab = url.searchParams.get("tab") ?? "dash";
        expect(workspaces.has(role), destination.href).toBe(true);
        expect(tab === "approvals" || WS_TABS[role].some((item) => item.key === tab), destination.href).toBe(true);
      }
    }
  });

  it("builds deterministic guidance with approval and governance hard stops", () => {
    const result = buildMedicalDirectorReviewDraft("evidence_completeness_review");
    expect(result).toMatchObject({ policyVersion: "2026-08-17.1", taskVersion: "medical_director.review_checklist.v1", title: "Evidence completeness review checklist", context: { role: "Medical Director", workflowKey: "evidence_completeness_review" } });
    expect(result.draft).toContain("does not inspect evidence, decide completeness");
    expect(result.draft).toContain("cannot confirm that anything exists, is complete, is safe");
    expect(result.caution).toContain("No approval queue");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|document_id|order_id|prescription_id|result_id|email|phone|record_id/i);
  });

  it("has no free-text, AI, application-record read, or approval path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/medical-director-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/MedicalDirectorAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|consultations|medical_records|orders|prescriptions|lab_results|diet_plans|diet_assessments|concerns|safety_events|referrals|appointments|messages)["']\)/);
    expect(action).toContain('.rpc("create_medical_director_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(action).not.toContain("reviewDietPlan");
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
