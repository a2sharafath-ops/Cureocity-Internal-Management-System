import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import { WS_TABS } from "@/lib/workspaces";
import {
  FITNESS_TRAINER_WORKFLOWS,
  buildFitnessTrainerOperationalDraft,
  fitnessTrainerWorkflowProblem,
} from "@/lib/fitness-trainer-assistant";

describe("Fitness Trainer workspace checklist Assistant", () => {
  it("offers only the four approved static workflow choices", () => {
    expect(FITNESS_TRAINER_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "today_and_roster",
      "session_coordination",
      "workout_planning",
      "summary_and_handoff",
    ]);
    expect(fitnessTrainerWorkflowProblem("workout_planning")).toBeNull();
    expect(fitnessTrainerWorkflowProblem("prescribe_workout")).toContain("approved Fitness Trainer workflow");
  });

  it("uses only existing Trainer-visible routes and workspace tabs", () => {
    const trainerTabs = new Set(WS_TABS.trainer.map((tab) => tab.key));
    for (const workflow of FITNESS_TRAINER_WORKFLOWS) {
      for (const destination of workflow.destinations) {
        const [path, query = ""] = destination.href.split("?");
        expect(canSee("Fitness Trainer", path), `${workflow.key}:${destination.href}`).toBe(true);
        expect(canSee("Staff", path), `${workflow.key}:${destination.href}`).toBe(false);
        const tab = new URLSearchParams(query).get("tab");
        if (tab) expect(trainerTabs.has(tab), `${workflow.key}:${tab}`).toBe(true);
      }
    }
  });

  it("builds a deterministic evidence-linked checklist without record context", () => {
    const result = buildFitnessTrainerOperationalDraft("workout_planning");
    expect(result).toMatchObject({
      policyVersion: "2026-08-17.1",
      taskVersion: "fitness_trainer.operational_checklist.v1",
      title: "Workout planning workspace checklist",
      context: { role: "Fitness Trainer", workflowKey: "workout_planning" },
    });
    expect(result.context.destinations.map((item) => item.href)).toEqual([
      "/workspace?role=trainer&tab=planner",
      "/workspace?role=trainer&tab=exlib",
    ]);
    expect(result.evidence).toHaveLength(2);
    expect(result.caution).toContain("No client, clinical, assessment, workout, session, finance, HR, staff or message record was read");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|appointment_id|assessment_id|workout_id|email|phone|staff_id/i);
  });

  it("has no free-text request, external AI, or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/fitness-trainer-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/FitnessTrainerAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|staff|appointments|sessions|consultations|client_workouts|assessments|tasks)["']\)/);
    expect(action).toContain('.rpc("create_fitness_trainer_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
