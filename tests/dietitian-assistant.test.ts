import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WS_TABS } from "@/lib/workspaces";
import { DIETITIAN_WORKFLOWS, buildDietitianReviewDraft, dietitianWorkflowProblem } from "@/lib/dietitian-assistant";

describe("Dietitian review-checklist Assistant", () => {
  it("offers only the four approved static review workflows", () => {
    expect(DIETITIAN_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "chart_review_readiness", "nutrition_targets", "meal_option_completeness", "monitoring_and_handoff",
    ]);
    expect(dietitianWorkflowProblem("nutrition_targets")).toBeNull();
    expect(dietitianWorkflowProblem("publish_chart")).toContain("approved Dietitian review workflow");
  });

  it("uses only existing Dietitian workspace tabs", () => {
    const allowedTabs = new Set(WS_TABS.diet.map((tab) => tab.key));
    for (const workflow of DIETITIAN_WORKFLOWS) {
      for (const destination of workflow.destinations) {
        const url = new URL(destination.href, "https://cureocity.test");
        expect(url.pathname).toBe("/workspace");
        expect(url.searchParams.get("role")).toBe("diet");
        expect(allowedTabs.has(url.searchParams.get("tab") ?? ""), `${workflow.key}:${destination.href}`).toBe(true);
      }
    }
  });

  it("builds deterministic evidence-linked guidance without record context", () => {
    const result = buildDietitianReviewDraft("meal_option_completeness");
    expect(result).toMatchObject({
      policyVersion: "2026-08-17.1",
      taskVersion: "dietitian.review_checklist.v1",
      title: "Meal-option completeness checklist",
      context: { role: "Dietitian", workflowKey: "meal_option_completeness" },
    });
    expect(result.context.checks).toContain("Every active meal slot must contain exactly four reviewed options.");
    expect(result.draft).toContain("micronutrient line");
    expect(result.caution).toContain("No client, clinical, consultation, assessment, chart, meal, recipe, monitoring, concern, finance, HR, staff or message record was read");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|consultation_id|chart_id|meal_id|email|phone|record_id/i);
  });

  it("anchors its checklist in existing deterministic chart problems", () => {
    const rules = readFileSync(resolve(process.cwd(), "lib/diet-plan.ts"), "utf8");
    for (const existingRule of [
      "No daily calorie target set.",
      "No daily water intake target set.",
      "every active meal slot must have exactly 4.",
      "has no micronutrients listed.",
    ]) expect(rules).toContain(existingRule);
  });

  it("has no free-text request, external AI, or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/dietitian-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/DietitianAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|consultations|diet_plans|meal_monitoring|concerns|recipes|dishes|staff|messages)["']\)/);
    expect(action).toContain('.rpc("create_dietitian_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
