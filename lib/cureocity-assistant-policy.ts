import { COACH_COPILOT_TASKS } from "@/lib/coach-copilot";
import type { Role } from "@/lib/roles";
import { SUPER_ADMIN_COPILOT_TASKS } from "@/lib/super-admin-copilot";

export const CUREOCITY_ASSISTANT_POLICY_VERSION = "2026-08-17.1";

export const CUREOCITY_ASSISTANT_STAFF_ROLES: Role[] = [
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

export type AssistantActionTier = 0 | 1 | 2 | "X";
export type AssistantImplementationState = "implemented" | "not_approved";
export type AssistantExecutionMode = "guarded_ai" | "deterministic";

export type AssistantTaskManifest = {
  policyVersion: typeof CUREOCITY_ASSISTANT_POLICY_VERSION;
  taskVersion: string;
  role: Role;
  key: string;
  label: string;
  owner: string;
  implementation: AssistantImplementationState;
  executionMode: AssistantExecutionMode;
  featureFlag: string;
  requiresExternalAi: boolean;
  actionTier: AssistantActionTier;
  dataContract: {
    sources: readonly string[];
    allowedFields: readonly string[];
    classifications: readonly ("Public application metadata" | "Internal operational" | "Client behavioural coordination")[];
    forbiddenSources: readonly string[];
  };
  approval: {
    reviewRequired: true;
    reviewerRoles: readonly Role[];
    acceptanceEffect: "Stores reviewed working text only; performs no action";
  };
  prohibitedActions: readonly string[];
};

const NO_ACTIONS = [
  "send or contact anyone",
  "create, update, approve, publish, assign, close, or delete a record",
  "change access, credentials, configuration, or infrastructure",
  "execute a clinical, financial, HR, or safety decision",
] as const;

const manifest = (
  input: Omit<AssistantTaskManifest, "policyVersion" | "approval" | "prohibitedActions"> & {
    reviewerRoles: readonly Role[];
    prohibitedActions?: readonly string[];
  },
): AssistantTaskManifest => {
  const { reviewerRoles, prohibitedActions, ...task } = input;
  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    ...task,
    approval: {
      reviewRequired: true,
      reviewerRoles,
      acceptanceEffect: "Stores reviewed working text only; performs no action",
    },
    prohibitedActions: prohibitedActions ?? NO_ACTIONS,
  };
};

const superAdminManifests: AssistantTaskManifest[] = SUPER_ADMIN_COPILOT_TASKS.map((task) => manifest({
  taskVersion: `super_admin.${task.key}.v1`,
  role: "Super Admin",
  key: task.key,
  label: task.label,
  owner: "Cureocity product owner",
  implementation: "implemented",
  executionMode: "guarded_ai",
  featureFlag: "STAFF_COPILOT_SUPER_ADMIN_ENABLED",
  requiresExternalAi: true,
  actionTier: 2,
  reviewerRoles: ["Super Admin"],
  dataContract: {
    sources: ["tasks", "followups", "profiles", "staff", "appointments"],
    allowedFields: [
      "aggregate counts by status, priority, kind, role, branch, and type",
      "anonymized overdue item references and dates",
      "directory linkage and role-consistency counts",
    ],
    classifications: ["Internal operational"],
    forbiddenSources: ["client identity", "clinical records", "credentials", "message content", "financial account data"],
  },
}));

const healthCoachManifests: AssistantTaskManifest[] = COACH_COPILOT_TASKS.map((task) => manifest({
  taskVersion: `health_coach.${task.key}.v1`,
  role: "Health Coach",
  key: task.key,
  label: task.label,
  owner: "Medical Director and Health Coach domain owner",
  implementation: "implemented",
  executionMode: "guarded_ai",
  featureFlag: "HEALTH_COACH_COPILOT_ENABLED",
  requiresExternalAi: true,
  actionTier: 2,
  reviewerRoles: ["Health Coach"],
  dataContract: {
    sources: [
      "coach_goals", "coach_adherence_events", "coach_barriers", "coach_assessments",
      "coach_session_workflows", "clinical_referrals", "safety_events", "mdt_tasks", "mdt_huddles",
    ],
    allowedFields: ["bounded behavioural coordination fields for one server-authorized client"],
    classifications: ["Client behavioural coordination"],
    forbiddenSources: ["laboratory interpretation", "prescription decisions", "therapy notes outside the approved record", "credentials"],
  },
}));

export const STAFF_NAVIGATION_TASK_KEY = "navigation_checklist";
export const FRONT_DESK_OPERATIONAL_TASK_KEY = "operational_checklist";
export const FITNESS_TRAINER_OPERATIONAL_TASK_KEY = "operational_checklist";
export const ADMINISTRATOR_GOVERNANCE_TASK_KEY = "governance_checklist";

const staffNavigationManifest = manifest({
  taskVersion: "staff.navigation_checklist.v1",
  role: "Staff",
  key: STAFF_NAVIGATION_TASK_KEY,
  label: "Draft an app navigation checklist",
  owner: "Cureocity product owner",
  implementation: "implemented",
  executionMode: "deterministic",
  featureFlag: "STAFF_COPILOT_STAFF_ENABLED",
  requiresExternalAi: false,
  actionTier: 1,
  reviewerRoles: ["Staff"],
  dataContract: {
    sources: ["versioned Cureocity route metadata", "authenticated real role"],
    allowedFields: ["route label", "route path", "short purpose", "role visibility"],
    classifications: ["Public application metadata"],
    forbiddenSources: ["client records", "staff records", "clinical data", "finance data", "HR data", "free-form SOP content"],
  },
  prohibitedActions: [
    ...NO_ACTIONS,
    "claim that a route, permission, workflow, or record exists when it is not in the supplied route contract",
  ],
});

const frontDeskOperationalManifest = manifest({
  taskVersion: "front_desk.operational_checklist.v1",
  role: "Front Desk",
  key: FRONT_DESK_OPERATIONAL_TASK_KEY,
  label: "Prepare an operational navigation checklist",
  owner: "Cureocity Front Desk operations owner",
  implementation: "implemented",
  executionMode: "deterministic",
  featureFlag: "STAFF_COPILOT_FRONT_DESK_ENABLED",
  requiresExternalAi: false,
  actionTier: 1,
  reviewerRoles: ["Front Desk"],
  dataContract: {
    sources: ["versioned Front Desk workflow metadata", "authenticated real role", "existing route permission map"],
    allowedFields: ["workflow label", "route label", "route path", "static purpose", "ordered navigation step"],
    classifications: ["Public application metadata", "Internal operational"],
    forbiddenSources: ["client records", "clinical records", "finance records", "HR records", "staff records", "messages", "credentials", "free-form SOP content"],
  },
  prohibitedActions: [
    ...NO_ACTIONS,
    "book, reschedule, cancel, contact, collect, mark complete, or otherwise act on an operational item",
    "claim that a client, appointment, consent, payment, or follow-up exists or is complete",
  ],
});

const fitnessTrainerOperationalManifest = manifest({
  taskVersion: "fitness_trainer.operational_checklist.v1",
  role: "Fitness Trainer",
  key: FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
  label: "Prepare a trainer workspace checklist",
  owner: "Cureocity Fitness Trainer domain owner",
  implementation: "implemented",
  executionMode: "deterministic",
  featureFlag: "STAFF_COPILOT_FITNESS_TRAINER_ENABLED",
  requiresExternalAi: false,
  actionTier: 1,
  reviewerRoles: ["Fitness Trainer"],
  dataContract: {
    sources: ["versioned Fitness Trainer workspace metadata", "authenticated real role", "existing route and tab permission map"],
    allowedFields: ["workflow label", "workspace tab label", "route path", "static purpose", "ordered navigation step"],
    classifications: ["Public application metadata", "Internal operational"],
    forbiddenSources: ["client records", "clinical records", "assessment content", "workout plan records", "session records", "finance records", "HR records", "staff records", "messages", "credentials", "free-form SOP content"],
  },
  prohibitedActions: [
    ...NO_ACTIONS,
    "start or change a workout prescription, complete a session, schedule work, contact a client, or publish a plan",
    "claim that an assessment, appointment, session, plan, concern, restriction, or handoff exists or is complete",
  ],
});

const administratorGovernanceManifest = manifest({
  taskVersion: "administrator.governance_checklist.v1",
  role: "Administrator",
  key: ADMINISTRATOR_GOVERNANCE_TASK_KEY,
  label: "Prepare an administrator governance checklist",
  owner: "Cureocity Administrator governance owner",
  implementation: "implemented",
  executionMode: "deterministic",
  featureFlag: "STAFF_COPILOT_ADMINISTRATOR_ENABLED",
  requiresExternalAi: false,
  actionTier: 1,
  reviewerRoles: ["Administrator"],
  dataContract: {
    sources: ["versioned Administrator workflow metadata", "authenticated real role", "existing route permission map"],
    allowedFields: ["workflow label", "route label", "route path", "static purpose", "ordered navigation step"],
    classifications: ["Public application metadata", "Internal operational"],
    forbiddenSources: ["client records", "clinical records", "finance records", "HR records", "staff records", "access records", "issue records", "messages", "credentials", "free-form SOP content"],
  },
  prohibitedActions: [
    ...NO_ACTIONS,
    "grant, revoke, invite, deactivate, configure, resolve, assign, approve, publish, contact, or change any administrative item",
    "claim that an issue, user, permission, package, service, onboarding item, follow-up, or retention item exists or is complete",
  ],
});

export const CUREOCITY_ASSISTANT_TASK_MANIFESTS: readonly AssistantTaskManifest[] = [
  ...superAdminManifests,
  ...healthCoachManifests,
  staffNavigationManifest,
  frontDeskOperationalManifest,
  fitnessTrainerOperationalManifest,
  administratorGovernanceManifest,
];

export type AssistantPolicyDecision = {
  allowed: boolean;
  manifest: AssistantTaskManifest | null;
  reasons: string[];
};

export function assistantTaskManifestsForRole(role: string) {
  return CUREOCITY_ASSISTANT_TASK_MANIFESTS.filter((task) => task.role === role);
}

export function assistantTaskManifest(role: string, taskKey: string) {
  return CUREOCITY_ASSISTANT_TASK_MANIFESTS.find((task) => task.role === role && task.key === taskKey) ?? null;
}

/**
 * Server-side policy decision. Display/preview roles are deliberately absent:
 * the authenticated real role is the only principal accepted here.
 */
export function decideAssistantTask(input: {
  realRole: string;
  taskKey: string;
  env: Record<string, string | undefined>;
}): AssistantPolicyDecision {
  const task = assistantTaskManifest(input.realRole, input.taskKey);
  if (!task) return { allowed: false, manifest: null, reasons: ["This task is not approved for the authenticated role."] };

  const reasons: string[] = [];
  if (task.implementation !== "implemented") reasons.push("This task has not been implemented.");
  if (input.env.CUREOCITY_ASSISTANT_DISABLED === "true") reasons.push("The global Cureocity Assistant kill switch is active.");
  if (input.env[task.featureFlag] !== "true") reasons.push("The role feature flag is off.");
  if (task.requiresExternalAi && !input.env.OPENAI_API_KEY) reasons.push("The external AI connection is not configured.");
  return { allowed: reasons.length === 0, manifest: task, reasons };
}

export function assertAssistantPolicyIntegrity() {
  const identities = new Set<string>();
  for (const task of CUREOCITY_ASSISTANT_TASK_MANIFESTS) {
    const identity = `${task.role}:${task.key}`;
    if (identities.has(identity)) throw new Error(`Duplicate Cureocity Assistant task manifest: ${identity}`);
    identities.add(identity);
    if (!task.taskVersion || task.policyVersion !== CUREOCITY_ASSISTANT_POLICY_VERSION) {
      throw new Error(`Unversioned Cureocity Assistant task manifest: ${identity}`);
    }
    if (!task.owner || !task.dataContract.sources.length || !task.dataContract.allowedFields.length || !task.dataContract.forbiddenSources.length) {
      throw new Error(`Incomplete Cureocity Assistant data contract: ${identity}`);
    }
    if (!task.approval.reviewRequired || task.approval.acceptanceEffect !== "Stores reviewed working text only; performs no action") {
      throw new Error(`Unsafe Cureocity Assistant approval contract: ${identity}`);
    }
  }
  return true;
}
