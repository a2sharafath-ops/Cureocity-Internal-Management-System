import { describe, expect, it } from "vitest";
import { STAFF_COPILOT_ROLES, staffCopilotAvailability, staffCopilotDefinition } from "@/lib/staff-copilot";

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
    const inertRoles = STAFF_COPILOT_ROLES.filter((role) => !["Super Admin", "Health Coach"].includes(role));
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
});
