import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import { WS_TABS } from "@/lib/workspaces";
import { DOCTOR_WORKFLOWS, buildDoctorReviewDraft, doctorWorkflowProblem } from "@/lib/doctor-assistant";

describe("Doctor workflow-checklist Assistant", () => {
  it("offers only the four approved static workflows", () => {
    expect(DOCTOR_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "daily_clinical_orientation", "consultation_and_emr_documentation", "orders_and_results_review", "safety_and_mdt_coordination",
    ]);
    expect(doctorWorkflowProblem("orders_and_results_review")).toBeNull();
    expect(doctorWorkflowProblem("prescribe_medication")).toContain("approved Doctor workflow");
  });

  it("uses only existing Doctor-visible destinations", () => {
    const tabs = new Set(WS_TABS.doctor.map((tab) => tab.key));
    for (const workflow of DOCTOR_WORKFLOWS) for (const destination of workflow.destinations) {
      const url = new URL(destination.href, "https://cureocity.test");
      expect(canSee("Doctor", url.pathname), destination.href).toBe(true);
      if (url.pathname === "/workspace") {
        expect(url.searchParams.get("role")).toBe("doctor");
        expect(tabs.has(url.searchParams.get("tab") ?? ""), destination.href).toBe(true);
      }
    }
  });

  it("builds deterministic guidance with explicit clinical hard stops", () => {
    const result = buildDoctorReviewDraft("orders_and_results_review");
    expect(result).toMatchObject({ policyVersion: "2026-08-17.1", taskVersion: "doctor.workflow_checklist.v1", title: "Orders and results review checklist", context: { role: "Doctor", workflowKey: "orders_and_results_review" } });
    expect(result.draft).toContain("does not read or interpret results");
    expect(result.draft).toContain("suggest a dose");
    expect(result.caution).toContain("No client, medical, consultation, EMR, result, order, prescription, note, appointment, concern, safety, referral, finance, HR, staff or message record was read");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|consultation_id|order_id|prescription_id|result_id|email|phone|record_id/i);
  });

  it("has no free-text, AI, or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/doctor-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/DoctorAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|consultations|medical_records|orders|prescriptions|lab_results|concerns|safety_events|referrals|appointments|messages)["']\)/);
    expect(action).toContain('.rpc("create_doctor_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
