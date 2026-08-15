import { COACH_COPILOT_TASKS } from "@/lib/coach-copilot";
import { SUPER_ADMIN_COPILOT_TASKS } from "@/lib/super-admin-copilot";
import type { Role } from "@/lib/roles";

export const STAFF_COPILOT_ROLES: Role[] = [
  "Super Admin",
  "Administrator",
  "Manager",
  "Medical Director",
  "Front Desk",
  "Doctor",
  "Dietitian",
  "Fitness Trainer",
  "Health Coach",
  "Psychologist",
  "Finance",
  "HR",
  "Staff",
];

export type StaffCopilotDefinition = {
  role: Role;
  title: string;
  functional: boolean;
  featureFlag: string;
  allowedTasks: readonly string[];
  existingHref: string | null;
};

const flagFor = (role: Role) => `STAFF_COPILOT_${role.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_ENABLED`;

export function staffCopilotDefinition(role: string): StaffCopilotDefinition | null {
  if (!(STAFF_COPILOT_ROLES as string[]).includes(role)) return null;
  const staffRole = role as Role;
  if (staffRole === "Super Admin") {
    return {
      role: staffRole,
      title: "Super Admin Copilot",
      functional: true,
      featureFlag: "STAFF_COPILOT_SUPER_ADMIN_ENABLED",
      allowedTasks: SUPER_ADMIN_COPILOT_TASKS.map((task) => task.label),
      existingHref: null,
    };
  }
  if (staffRole === "Health Coach") {
    return {
      role: staffRole,
      title: "Health Coach Copilot",
      functional: true,
      featureFlag: "HEALTH_COACH_COPILOT_ENABLED",
      allowedTasks: COACH_COPILOT_TASKS.map((task) => task.label),
      existingHref: "/workspace?role=coach&tab=copilot",
    };
  }
  return {
    role: staffRole,
    title: `${staffRole} Copilot`,
    functional: false,
    featureFlag: flagFor(staffRole),
    allowedTasks: [],
    existingHref: null,
  };
}

export function staffCopilotAvailability(
  role: string,
  env: Record<string, string | undefined>,
): { enabled: boolean; reasons: string[] } {
  const definition = staffCopilotDefinition(role);
  if (!definition) return { enabled: false, reasons: ["Copilot is available only to authenticated staff."] };
  if (!definition.functional || definition.allowedTasks.length === 0) {
    return {
      enabled: false,
      reasons: ["Allowed tasks and role boundaries have not been approved for this role."],
    };
  }
  const reasons: string[] = [];
  if (env[definition.featureFlag] !== "true") reasons.push("The role feature flag is off.");
  if (!env.OPENAI_API_KEY) reasons.push("The external AI connection is not configured.");
  return { enabled: reasons.length === 0, reasons };
}
