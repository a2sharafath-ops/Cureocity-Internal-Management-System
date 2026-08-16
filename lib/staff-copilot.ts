import { COACH_COPILOT_TASKS } from "@/lib/coach-copilot";
import { SUPER_ADMIN_COPILOT_TASKS } from "@/lib/super-admin-copilot";
import type { Role } from "@/lib/roles";

export const CUREOCITY_ASSISTANT_NAME = "Cureocity Assistant";
export const CUREOCITY_ASSISTANT_VOICE_LABEL = "Voice input · coming soon";

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
      title: "Cureocity Assistant for Super Admin",
      functional: true,
      featureFlag: "STAFF_COPILOT_SUPER_ADMIN_ENABLED",
      allowedTasks: SUPER_ADMIN_COPILOT_TASKS.map((task) => task.label),
      existingHref: null,
    };
  }
  if (staffRole === "Health Coach") {
    return {
      role: staffRole,
      title: "Cureocity Assistant for Health Coach",
      functional: true,
      featureFlag: "HEALTH_COACH_COPILOT_ENABLED",
      allowedTasks: COACH_COPILOT_TASKS.map((task) => task.label),
      existingHref: "/workspace?role=coach&tab=copilot",
    };
  }
  return {
    role: staffRole,
    title: `Cureocity Assistant for ${staffRole}`,
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

export type StaffAssistantSurface = {
  visible: boolean;
  role: Role | null;
  title: string;
  functional: boolean;
  enabled: boolean;
  reasons: string[];
  allowedTasks: string[];
  fullWorkspaceHref: string;
  quickPromptEnabled: boolean;
  quickPromptHelp: string;
  voiceInputEnabled: false;
};

/**
 * One server-derived contract for the global Assistant launcher.
 *
 * The global panel can invoke only the existing Super Admin draft action. The
 * Health Coach flow needs a server-authorized client selection and therefore
 * continues in its guarded workspace. Unapproved roles stay visibly inert even
 * if somebody sets a future-looking environment flag.
 */
export function staffAssistantSurface(
  role: string,
  env: Record<string, string | undefined>,
): StaffAssistantSurface {
  const definition = staffCopilotDefinition(role);
  if (!definition) {
    return {
      visible: false,
      role: null,
      title: CUREOCITY_ASSISTANT_NAME,
      functional: false,
      enabled: false,
      reasons: ["Cureocity Assistant is available only to authenticated staff."],
      allowedTasks: [],
      fullWorkspaceHref: "/copilot",
      quickPromptEnabled: false,
      quickPromptHelp: "No staff assistant is available for this account.",
      voiceInputEnabled: false,
    };
  }

  const availability = staffCopilotAvailability(role, env);
  const quickPromptEnabled = role === "Super Admin" && availability.enabled;
  const quickPromptHelp = quickPromptEnabled
    ? "Choose one approved review-only task. Your request uses the existing guarded Super Admin draft action."
    : role === "Health Coach" && availability.enabled
      ? "Open the Health Coach workspace to select an authorized client before entering text."
      : definition.functional
        ? "Text input remains unavailable until this role's approved capability and required configuration are active."
        : `No assistant task has been approved for ${role}.`;

  return {
    visible: true,
    role: definition.role,
    title: definition.title,
    functional: definition.functional,
    enabled: availability.enabled,
    reasons: availability.reasons,
    allowedTasks: [...definition.allowedTasks],
    fullWorkspaceHref: definition.existingHref ?? "/copilot",
    quickPromptEnabled,
    quickPromptHelp,
    voiceInputEnabled: false,
  };
}
