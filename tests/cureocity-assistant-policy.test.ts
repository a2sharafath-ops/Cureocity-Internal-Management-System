import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  CUREOCITY_ASSISTANT_STAFF_ROLES,
  CUREOCITY_ASSISTANT_TASK_MANIFESTS,
  ADMINISTRATOR_GOVERNANCE_TASK_KEY,
  FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
  FRONT_DESK_OPERATIONAL_TASK_KEY,
  STAFF_NAVIGATION_TASK_KEY,
  assertAssistantPolicyIntegrity,
  assistantTaskManifestsForRole,
  decideAssistantTask,
} from "@/lib/cureocity-assistant-policy";

describe("versioned Cureocity Assistant task policy", () => {
  it("covers every real staff role while keeping unimplemented roles without callable tasks", () => {
    expect(CUREOCITY_ASSISTANT_STAFF_ROLES).toHaveLength(13);
    expect(assistantTaskManifestsForRole("Super Admin")).toHaveLength(4);
    expect(assistantTaskManifestsForRole("Health Coach")).toHaveLength(9);
    expect(assistantTaskManifestsForRole("Staff")).toHaveLength(1);
    expect(assistantTaskManifestsForRole("Front Desk")).toHaveLength(1);
    expect(assistantTaskManifestsForRole("Fitness Trainer")).toHaveLength(1);
    expect(assistantTaskManifestsForRole("Administrator")).toHaveLength(1);
    for (const role of ["Manager", "Medical Director", "Doctor", "Dietitian", "Psychologist", "Finance", "HR"]) {
      expect(assistantTaskManifestsForRole(role), role).toEqual([]);
    }
  });

  it("requires complete versioned data and approval contracts for every implemented task", () => {
    expect(assertAssistantPolicyIntegrity()).toBe(true);
    for (const task of CUREOCITY_ASSISTANT_TASK_MANIFESTS) {
      expect(task.policyVersion).toBe(CUREOCITY_ASSISTANT_POLICY_VERSION);
      expect(task.taskVersion).toMatch(/\.v1$/);
      expect(task.owner).toBeTruthy();
      expect(task.dataContract.sources.length).toBeGreaterThan(0);
      expect(task.dataContract.allowedFields.length).toBeGreaterThan(0);
      expect(task.dataContract.forbiddenSources.length).toBeGreaterThan(0);
      expect(task.approval).toMatchObject({
        reviewRequired: true,
        acceptanceEffect: "Stores reviewed working text only; performs no action",
      });
      expect(task.prohibitedActions).toContain("send or contact anyone");
    }
  });

  it("authorizes only the authenticated real role and exact task", () => {
    expect(decideAssistantTask({
      realRole: "Staff",
      taskKey: STAFF_NAVIGATION_TASK_KEY,
      env: { STAFF_COPILOT_STAFF_ENABLED: "true" },
    })).toMatchObject({ allowed: true, manifest: { role: "Staff", executionMode: "deterministic", requiresExternalAi: false } });

    expect(decideAssistantTask({
      realRole: "Doctor",
      taskKey: STAFF_NAVIGATION_TASK_KEY,
      env: { STAFF_COPILOT_STAFF_ENABLED: "true" },
    })).toEqual({ allowed: false, manifest: null, reasons: ["This task is not approved for the authenticated role."] });
    expect(decideAssistantTask({
      realRole: "Client",
      taskKey: STAFF_NAVIGATION_TASK_KEY,
      env: { STAFF_COPILOT_STAFF_ENABLED: "true" },
    }).allowed).toBe(false);

    expect(decideAssistantTask({
      realRole: "Front Desk",
      taskKey: FRONT_DESK_OPERATIONAL_TASK_KEY,
      env: { STAFF_COPILOT_FRONT_DESK_ENABLED: "true" },
    })).toMatchObject({ allowed: true, manifest: { role: "Front Desk", executionMode: "deterministic", requiresExternalAi: false } });
    expect(decideAssistantTask({
      realRole: "Manager",
      taskKey: FRONT_DESK_OPERATIONAL_TASK_KEY,
      env: { STAFF_COPILOT_FRONT_DESK_ENABLED: "true" },
    }).allowed).toBe(false);

    expect(decideAssistantTask({
      realRole: "Fitness Trainer",
      taskKey: FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
      env: { STAFF_COPILOT_FITNESS_TRAINER_ENABLED: "true" },
    })).toMatchObject({ allowed: true, manifest: { role: "Fitness Trainer", executionMode: "deterministic", requiresExternalAi: false } });
    expect(decideAssistantTask({
      realRole: "Dietitian",
      taskKey: FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
      env: { STAFF_COPILOT_FITNESS_TRAINER_ENABLED: "true" },
    }).allowed).toBe(false);

    expect(decideAssistantTask({
      realRole: "Administrator",
      taskKey: ADMINISTRATOR_GOVERNANCE_TASK_KEY,
      env: { STAFF_COPILOT_ADMINISTRATOR_ENABLED: "true" },
    })).toMatchObject({ allowed: true, manifest: { role: "Administrator", executionMode: "deterministic", requiresExternalAi: false } });
    expect(decideAssistantTask({
      realRole: "Manager",
      taskKey: ADMINISTRATOR_GOVERNANCE_TASK_KEY,
      env: { STAFF_COPILOT_ADMINISTRATOR_ENABLED: "true" },
    }).allowed).toBe(false);
  });

  it("requires AI configuration only for tasks whose manifest says so", () => {
    expect(decideAssistantTask({
      realRole: "Staff",
      taskKey: STAFF_NAVIGATION_TASK_KEY,
      env: { STAFF_COPILOT_STAFF_ENABLED: "true" },
    }).reasons).toEqual([]);
    expect(decideAssistantTask({
      realRole: "Front Desk",
      taskKey: FRONT_DESK_OPERATIONAL_TASK_KEY,
      env: { STAFF_COPILOT_FRONT_DESK_ENABLED: "true" },
    }).reasons).toEqual([]);
    expect(decideAssistantTask({
      realRole: "Fitness Trainer",
      taskKey: FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
      env: { STAFF_COPILOT_FITNESS_TRAINER_ENABLED: "true" },
    }).reasons).toEqual([]);
    expect(decideAssistantTask({
      realRole: "Administrator",
      taskKey: ADMINISTRATOR_GOVERNANCE_TASK_KEY,
      env: { STAFF_COPILOT_ADMINISTRATOR_ENABLED: "true" },
    }).reasons).toEqual([]);
    expect(decideAssistantTask({
      realRole: "Super Admin",
      taskKey: "operational_summary",
      env: { STAFF_COPILOT_SUPER_ADMIN_ENABLED: "true" },
    }).reasons).toEqual(["The external AI connection is not configured."]);
  });

  it("enforces the shared task decision inside each existing generation action", () => {
    const superAdminAction = readFileSync(resolve(process.cwd(), "lib/staff-copilot-actions.ts"), "utf8");
    const healthCoachAction = readFileSync(resolve(process.cwd(), "lib/actions.ts"), "utf8");
    expect(superAdminAction).toContain("decideAssistantTask({ realRole: profile.role, taskKey, env: process.env })");
    expect(healthCoachAction).toContain("decideAssistantTask({ realRole: p.role, taskKey: task, env: process.env })");
  });
});
