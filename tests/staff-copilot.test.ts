import { describe, expect, it } from "vitest";
import {
  CUREOCITY_ASSISTANT_NAME,
  STAFF_COPILOT_ROLES,
  staffAssistantSurface,
  staffCopilotAvailability,
  staffCopilotDefinition,
} from "@/lib/staff-copilot";

describe("role-aware Staff Copilot framework", () => {
  it("covers every staff role but never clients", () => {
    expect(STAFF_COPILOT_ROLES).toHaveLength(13);
    for (const role of STAFF_COPILOT_ROLES) expect(staffCopilotDefinition(role)?.role).toBe(role);
    expect(staffCopilotDefinition("Client")).toBeNull();
  });

  it("preserves the approved Health Coach task allowlist", () => {
    const coach = staffCopilotDefinition("Health Coach");
    expect(coach?.functional).toBe(true);
    expect(coach?.allowedTasks).toHaveLength(9);
    expect(coach?.existingHref).toContain("tab=copilot");
  });

  it("enables only the approved four-task Super Admin pilot definition", () => {
    const superAdmin = staffCopilotDefinition("Super Admin");
    expect(superAdmin).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_SUPER_ADMIN_ENABLED",
      existingHref: null,
    });
    expect(superAdmin?.allowedTasks).toEqual([
      "Draft an operational summary",
      "Flag overdue items",
      "Prepare a staff-access review draft",
      "Suggest operational follow-ups",
    ]);
  });

  it("keeps every undefined role inert even if a future-looking flag is set", () => {
    const inertRoles = STAFF_COPILOT_ROLES.filter((role) => !["Super Admin", "Health Coach", "Staff", "Front Desk", "Fitness Trainer", "Administrator", "Manager"].includes(role));
    for (const role of inertRoles) {
      expect(staffCopilotDefinition(role)?.functional).toBe(false);
      expect(staffCopilotDefinition(role)?.allowedTasks).toEqual([]);
    }
    expect(staffCopilotAvailability("Doctor", {
      STAFF_COPILOT_DOCTOR_ENABLED: "true",
      OPENAI_API_KEY: "test-only-key",
    })).toEqual({
      enabled: false,
      reasons: ["Allowed tasks and role boundaries have not been approved for this role."],
    });
  });

  it("defines the deterministic Staff navigation pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Staff")).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_STAFF_ENABLED",
      requiresExternalAi: false,
      allowedTasks: ["Draft an app navigation checklist"],
    });
    expect(staffCopilotAvailability("Staff", {})).toEqual({
      enabled: false,
      reasons: ["The role feature flag is off."],
    });
    expect(staffCopilotAvailability("Staff", { STAFF_COPILOT_STAFF_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Front Desk checklist pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Front Desk")).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_FRONT_DESK_ENABLED",
      requiresExternalAi: false,
      allowedTasks: ["Prepare an operational navigation checklist"],
    });
    expect(staffCopilotAvailability("Front Desk", {})).toEqual({
      enabled: false,
      reasons: ["The role feature flag is off."],
    });
    expect(staffCopilotAvailability("Front Desk", { STAFF_COPILOT_FRONT_DESK_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Fitness Trainer checklist pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Fitness Trainer")).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_FITNESS_TRAINER_ENABLED",
      requiresExternalAi: false,
      allowedTasks: ["Prepare a trainer workspace checklist"],
    });
    expect(staffCopilotAvailability("Fitness Trainer", {})).toEqual({
      enabled: false,
      reasons: ["The role feature flag is off."],
    });
    expect(staffCopilotAvailability("Fitness Trainer", { STAFF_COPILOT_FITNESS_TRAINER_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Administrator governance pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Administrator")).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_ADMINISTRATOR_ENABLED",
      requiresExternalAi: false,
      allowedTasks: ["Prepare an administrator governance checklist"],
    });
    expect(staffCopilotAvailability("Administrator", {})).toEqual({
      enabled: false,
      reasons: ["The role feature flag is off."],
    });
    expect(staffCopilotAvailability("Administrator", { STAFF_COPILOT_ADMINISTRATOR_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Manager operations pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Manager")).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_MANAGER_ENABLED",
      requiresExternalAi: false,
      allowedTasks: ["Prepare a manager operations checklist"],
    });
    expect(staffCopilotAvailability("Manager", {})).toEqual({ enabled: false, reasons: ["The role feature flag is off."] });
    expect(staffCopilotAvailability("Manager", { STAFF_COPILOT_MANAGER_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("requires both the Health Coach role flag and external connection", () => {
    expect(staffCopilotAvailability("Health Coach", {})).toEqual({
      enabled: false,
      reasons: ["The role feature flag is off.", "The external AI connection is not configured."],
    });
    expect(staffCopilotAvailability("Health Coach", {
      HEALTH_COACH_COPILOT_ENABLED: "true",
      OPENAI_API_KEY: "test-only-key",
    })).toEqual({ enabled: true, reasons: [] });
  });

  it("keeps the Super Admin pilot disabled until both of its gates are configured", () => {
    expect(staffCopilotAvailability("Super Admin", {})).toEqual({
      enabled: false,
      reasons: ["The role feature flag is off.", "The external AI connection is not configured."],
    });
    expect(staffCopilotAvailability("Super Admin", {
      STAFF_COPILOT_SUPER_ADMIN_ENABLED: "true",
      OPENAI_API_KEY: "test-only-key",
    })).toEqual({ enabled: true, reasons: [] });
  });

  it("exposes the global Cureocity Assistant only to staff", () => {
    expect(CUREOCITY_ASSISTANT_NAME).toBe("Cureocity Assistant");
    expect(staffAssistantSurface("Client", {})).toMatchObject({
      visible: false,
      quickPromptEnabled: false,
      voiceInputEnabled: false,
    });
    expect(staffAssistantSurface("Doctor", {
      STAFF_COPILOT_DOCTOR_ENABLED: "true",
      OPENAI_API_KEY: "test-only-key",
    })).toMatchObject({
      visible: true,
      functional: false,
      enabled: false,
      quickPromptEnabled: false,
      voiceInputEnabled: false,
    });
  });

  it("routes global text only to an enabled existing guarded capability", () => {
    expect(staffAssistantSurface("Super Admin", {
      STAFF_COPILOT_SUPER_ADMIN_ENABLED: "true",
      OPENAI_API_KEY: "test-only-key",
    })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "super_admin",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Staff", {
      STAFF_COPILOT_STAFF_ENABLED: "true",
    })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "staff_navigation",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Front Desk", {
      STAFF_COPILOT_FRONT_DESK_ENABLED: "true",
    })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "front_desk_checklist",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Fitness Trainer", {
      STAFF_COPILOT_FITNESS_TRAINER_ENABLED: "true",
    })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "fitness_trainer_checklist",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Administrator", {
      STAFF_COPILOT_ADMINISTRATOR_ENABLED: "true",
    })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "administrator_checklist",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Manager", { STAFF_COPILOT_MANAGER_ENABLED: "true" })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "manager_checklist",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Health Coach", {
      HEALTH_COACH_COPILOT_ENABLED: "true",
      OPENAI_API_KEY: "test-only-key",
    })).toMatchObject({
      enabled: true,
      quickPromptEnabled: false,
      quickPromptKind: null,
      fullWorkspaceHref: "/workspace?role=coach&tab=copilot",
      voiceInputEnabled: false,
    });
  });

  it("honours the global kill switch across deterministic and AI-backed tasks", () => {
    expect(staffCopilotAvailability("Staff", {
      CUREOCITY_ASSISTANT_DISABLED: "true",
      STAFF_COPILOT_STAFF_ENABLED: "true",
    }).enabled).toBe(false);
    expect(staffCopilotAvailability("Super Admin", {
      CUREOCITY_ASSISTANT_DISABLED: "true",
      STAFF_COPILOT_SUPER_ADMIN_ENABLED: "true",
      OPENAI_API_KEY: "test-only-key",
    }).reasons).toContain("The global Cureocity Assistant kill switch is active.");
  });
});
