import {
  CUREOCITY_ASSISTANT_STAFF_ROLES,
  assistantTaskManifestsForRole,
} from "@/lib/cureocity-assistant-policy";
import type { Role } from "@/lib/roles";

export const CUREOCITY_ASSISTANT_NAME = "Cureocity Assistant";
export const CUREOCITY_ASSISTANT_VOICE_LABEL = "Voice input · coming soon";

export const STAFF_COPILOT_ROLES: Role[] = CUREOCITY_ASSISTANT_STAFF_ROLES;

export type StaffCopilotDefinition = {
  role: Role;
  title: string;
  functional: boolean;
  featureFlag: string;
  requiresExternalAi: boolean;
  allowedTasks: readonly string[];
  existingHref: string | null;
};

const flagFor = (role: Role) => `STAFF_COPILOT_${role.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_ENABLED`;

export function staffCopilotDefinition(role: string): StaffCopilotDefinition | null {
  if (!(STAFF_COPILOT_ROLES as string[]).includes(role)) return null;
  const staffRole = role as Role;
  const tasks = assistantTaskManifestsForRole(staffRole);
  const implemented = tasks.filter((task) => task.implementation === "implemented");
  return {
    role: staffRole,
    title: `Cureocity Assistant for ${staffRole}`,
    functional: implemented.length > 0,
    featureFlag: implemented[0]?.featureFlag ?? flagFor(staffRole),
    requiresExternalAi: implemented.some((task) => task.requiresExternalAi),
    allowedTasks: implemented.map((task) => task.label),
    existingHref: staffRole === "Health Coach" ? "/workspace?role=coach&tab=copilot" : null,
  };
}

export function staffCopilotAvailability(
  role: string,
  env: Record<string, string | undefined>,
): { enabled: boolean; reasons: string[] } {
  const definition = staffCopilotDefinition(role);
  if (!definition) return { enabled: false, reasons: ["Cureocity Assistant is available only to authenticated staff."] };
  if (!definition.functional || definition.allowedTasks.length === 0) {
    return {
      enabled: false,
      reasons: ["Allowed tasks and role boundaries have not been approved for this role."],
    };
  }
  const reasons: string[] = [];
  if (env.CUREOCITY_ASSISTANT_DISABLED === "true") reasons.push("The global Cureocity Assistant kill switch is active.");
  if (env[definition.featureFlag] !== "true") reasons.push("The role feature flag is off.");
  if (definition.requiresExternalAi && !env.OPENAI_API_KEY) reasons.push("The external AI connection is not configured.");
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
  quickPromptKind: "super_admin" | "staff_navigation" | "front_desk_checklist" | "fitness_trainer_checklist" | "administrator_checklist" | "manager_checklist" | "dietitian_checklist" | "psychologist_checklist" | null;
  quickPromptHelp: string;
  voiceInputEnabled: false;
};

/**
 * One server-derived contract for the global Assistant launcher.
 *
 * The global panel can invoke only explicitly implemented, role-bound actions:
 * guarded Super Admin drafts and deterministic Staff/Front Desk checklists.
 * The Health Coach flow needs a server-authorized client selection and therefore
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
      quickPromptKind: null,
      quickPromptHelp: "No staff assistant is available for this account.",
      voiceInputEnabled: false,
    };
  }

  const availability = staffCopilotAvailability(role, env);
  const quickPromptKind = availability.enabled
    ? role === "Super Admin"
      ? "super_admin"
      : role === "Staff"
        ? "staff_navigation"
        : role === "Front Desk"
          ? "front_desk_checklist"
          : role === "Fitness Trainer"
            ? "fitness_trainer_checklist"
          : role === "Administrator"
            ? "administrator_checklist"
          : role === "Manager"
            ? "manager_checklist"
          : role === "Dietitian"
            ? "dietitian_checklist"
          : role === "Psychologist"
            ? "psychologist_checklist"
        : null
    : null;
  const quickPromptEnabled = quickPromptKind !== null;
  const quickPromptHelp = quickPromptEnabled
    ? role === "Staff"
      ? "Ask where to find a Cureocity app area. This uses static navigation metadata only and saves a reviewable checklist; it reads no client, clinical, finance, HR, or staff records."
      : role === "Front Desk"
        ? "Choose one approved Front Desk workflow. The Assistant prepares a static route checklist only; it reads no client, clinical, finance, HR, staff, appointment, or message records."
        : role === "Fitness Trainer"
          ? "Choose one approved Fitness Trainer workflow. The Assistant prepares a static workspace checklist only; it reads no client, clinical, assessment, workout, session, finance, HR, staff, or message records."
        : role === "Administrator"
          ? "Choose one approved Administrator governance workflow. The Assistant prepares a static route checklist only; it reads no client, clinical, finance, HR, staff, access, issue, message, or other application records."
        : role === "Manager"
          ? "Choose one approved Manager operations workflow. The Assistant prepares a static route checklist only; it reads no client, clinical, coach, appointment, session, finance, HR, staff, access, message, or other application records."
        : role === "Dietitian"
          ? "Choose one approved Dietitian review workflow. The Assistant prepares a static checklist only; it reads no client, clinical, consultation, assessment, chart, meal, recipe, monitoring, concern, finance, HR, staff, or message records."
        : role === "Psychologist"
          ? "Choose one approved Psychologist workflow. The Assistant prepares a static checklist only; it reads no client, psychological, clinical, consultation, assessment, therapy-note, appointment, concern, safety, referral, finance, HR, staff, or message records."
        : "Choose one approved review-only task. Your request uses the existing guarded Super Admin draft action."
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
    quickPromptKind,
    quickPromptHelp,
    voiceInputEnabled: false,
  };
}
