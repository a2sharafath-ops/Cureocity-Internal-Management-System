import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WS_TABS } from "@/lib/workspaces";
import { PSYCHOLOGIST_WORKFLOWS, buildPsychologistReviewDraft, psychologistWorkflowProblem } from "@/lib/psychologist-assistant";

describe("Psychologist workflow-checklist Assistant", () => {
  it("offers only the four approved static workflows", () => {
    expect(PSYCHOLOGIST_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "daily_caseload_orientation", "consultation_documentation", "safety_and_concern_escalation", "blueprint_and_mdt_handoff",
    ]);
    expect(psychologistWorkflowProblem("consultation_documentation")).toBeNull();
    expect(psychologistWorkflowProblem("diagnose_client")).toContain("approved Psychologist workflow");
  });

  it("uses only existing Psychologist workspace tabs", () => {
    const tabs = new Set(WS_TABS.psych.map((tab) => tab.key));
    for (const workflow of PSYCHOLOGIST_WORKFLOWS) for (const destination of workflow.destinations) {
      const url = new URL(destination.href, "https://cureocity.test");
      expect(url.pathname).toBe("/workspace");
      expect(url.searchParams.get("role")).toBe("psych");
      expect(tabs.has(url.searchParams.get("tab") ?? ""), destination.href).toBe(true);
    }
  });

  it("builds deterministic guidance with explicit clinical and safety stops", () => {
    const result = buildPsychologistReviewDraft("safety_and_concern_escalation");
    expect(result).toMatchObject({
      policyVersion: "2026-08-17.1",
      taskVersion: "psychologist.workflow_checklist.v1",
      title: "Safety and concern escalation checklist",
      context: { role: "Psychologist", workflowKey: "safety_and_concern_escalation" },
    });
    expect(result.draft).toContain("does not assess risk");
    expect(result.draft).toContain("replace emergency procedures");
    expect(result.caution).toContain("No client, psychological, clinical, consultation, assessment, therapy-note, appointment, concern, safety, referral, finance, HR, staff or message record was read");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|consultation_id|assessment_id|note_id|email|phone|record_id/i);
  });

  it("has no free-text, AI, or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/psychologist-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/PsychologistAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|consultations|psychological_assessments|concerns|safety_events|referrals|appointments|messages)["']\)/);
    expect(action).toContain('.rpc("create_psychologist_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
