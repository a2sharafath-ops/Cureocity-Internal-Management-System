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

  it("gives every staff role an explicit bounded definition while unknown roles stay unavailable", () => {
    expect(STAFF_COPILOT_ROLES.filter((role) => !staffCopilotDefinition(role)?.functional)).toEqual([]);
    expect(staffCopilotAvailability("Client", { STAFF_COPILOT_CLIENT_ENABLED: "true" })).toEqual({
      enabled: false,
      reasons: ["Cureocity Assistant is available only to authenticated staff."],
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

  it("defines the deterministic Dietitian review pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Dietitian")).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_DIETITIAN_ENABLED",
      requiresExternalAi: false,
      allowedTasks: ["Prepare a Dietitian review checklist"],
    });
    expect(staffCopilotAvailability("Dietitian", {})).toEqual({ enabled: false, reasons: ["The role feature flag is off."] });
    expect(staffCopilotAvailability("Dietitian", { STAFF_COPILOT_DIETITIAN_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Psychologist workflow pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Psychologist")).toMatchObject({
      functional: true,
      featureFlag: "STAFF_COPILOT_PSYCHOLOGIST_ENABLED",
      requiresExternalAi: false,
      allowedTasks: ["Prepare a Psychologist workflow checklist"],
    });
    expect(staffCopilotAvailability("Psychologist", {})).toEqual({ enabled: false, reasons: ["The role feature flag is off."] });
    expect(staffCopilotAvailability("Psychologist", { STAFF_COPILOT_PSYCHOLOGIST_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Doctor workflow pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Doctor")).toMatchObject({ functional: true, featureFlag: "STAFF_COPILOT_DOCTOR_ENABLED", requiresExternalAi: false, allowedTasks: ["Prepare a Doctor workflow checklist"] });
    expect(staffCopilotAvailability("Doctor", {})).toEqual({ enabled: false, reasons: ["The role feature flag is off."] });
    expect(staffCopilotAvailability("Doctor", { STAFF_COPILOT_DOCTOR_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Medical Director review pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Medical Director")).toMatchObject({ functional: true, featureFlag: "STAFF_COPILOT_MEDICAL_DIRECTOR_ENABLED", requiresExternalAi: false, allowedTasks: ["Prepare a Medical Director review checklist"] });
    expect(staffCopilotAvailability("Medical Director", {})).toEqual({ enabled: false, reasons: ["The role feature flag is off."] });
    expect(staffCopilotAvailability("Medical Director", { STAFF_COPILOT_MEDICAL_DIRECTOR_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic Finance process pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("Finance")).toMatchObject({ functional: true, featureFlag: "STAFF_COPILOT_FINANCE_ENABLED", requiresExternalAi: false, allowedTasks: ["Prepare a Finance process checklist"] });
    expect(staffCopilotAvailability("Finance", {})).toEqual({ enabled: false, reasons: ["The role feature flag is off."] });
    expect(staffCopilotAvailability("Finance", { STAFF_COPILOT_FINANCE_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
  });

  it("defines the deterministic HR process pilot without requiring an AI key", () => {
    expect(staffCopilotDefinition("HR")).toMatchObject({ functional: true, featureFlag: "STAFF_COPILOT_HR_ENABLED", requiresExternalAi: false, allowedTasks: ["Prepare an HR process checklist"] });
    expect(staffCopilotAvailability("HR", {})).toEqual({ enabled: false, reasons: ["The role feature flag is off."] });
    expect(staffCopilotAvailability("HR", { STAFF_COPILOT_HR_ENABLED: "true" })).toEqual({ enabled: true, reasons: [] });
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
    expect(staffAssistantSurface("HR", {})).toMatchObject({ visible: true, functional: true, enabled: false, quickPromptEnabled: false, voiceInputEnabled: false });
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

    expect(staffAssistantSurface("Dietitian", { STAFF_COPILOT_DIETITIAN_ENABLED: "true" })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "dietitian_checklist",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Psychologist", { STAFF_COPILOT_PSYCHOLOGIST_ENABLED: "true" })).toMatchObject({
      enabled: true,
      quickPromptEnabled: true,
      quickPromptKind: "psychologist_checklist",
      fullWorkspaceHref: "/copilot",
      voiceInputEnabled: false,
    });

    expect(staffAssistantSurface("Doctor", { STAFF_COPILOT_DOCTOR_ENABLED: "true" })).toMatchObject({ enabled: true, quickPromptEnabled: true, quickPromptKind: "doctor_checklist", fullWorkspaceHref: "/copilot", voiceInputEnabled: false });

    expect(staffAssistantSurface("Medical Director", { STAFF_COPILOT_MEDICAL_DIRECTOR_ENABLED: "true" })).toMatchObject({ enabled: true, quickPromptEnabled: true, quickPromptKind: "medical_director_checklist", fullWorkspaceHref: "/copilot", voiceInputEnabled: false });

    expect(staffAssistantSurface("Finance", { STAFF_COPILOT_FINANCE_ENABLED: "true" })).toMatchObject({ enabled: true, quickPromptEnabled: true, quickPromptKind: "finance_checklist", fullWorkspaceHref: "/copilot", voiceInputEnabled: false });

    expect(staffAssistantSurface("HR", { STAFF_COPILOT_HR_ENABLED: "true" })).toMatchObject({ enabled: true, quickPromptEnabled: true, quickPromptKind: "hr_checklist", fullWorkspaceHref: "/copilot", voiceInputEnabled: false });

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
