import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const FITNESS_TRAINER_WORKFLOWS = [
  {
    key: "today_and_roster",
    label: "Today and roster",
    purpose: "Find the trainer's Today and My clients tabs without inspecting an underlying record through the Assistant.",
    destinations: [
      { label: "Today", href: "/workspace?role=trainer&tab=dash", purpose: "Open the Fitness Trainer Today tab." },
      { label: "My clients", href: "/workspace?role=trainer&tab=clients", purpose: "Open the Fitness Trainer roster tab." },
    ],
  },
  {
    key: "session_coordination",
    label: "Session coordination",
    purpose: "Find the existing appointment and training schedule areas without scheduling or completing a session through the Assistant.",
    destinations: [
      { label: "Appointments", href: "/workspace?role=trainer&tab=appts", purpose: "Open the trainer workspace Appointments tab." },
      { label: "Training Schedule", href: "/sessions", purpose: "Open the shared training schedule." },
    ],
  },
  {
    key: "workout_planning",
    label: "Workout planning",
    purpose: "Find the existing planning and exercise-library tabs without creating, editing or publishing a workout through the Assistant.",
    destinations: [
      { label: "Workout planner", href: "/workspace?role=trainer&tab=planner", purpose: "Open the Fitness Trainer workout-planner tab." },
      { label: "Exercise library", href: "/workspace?role=trainer&tab=exlib", purpose: "Open the Fitness Trainer exercise-library tab." },
    ],
  },
  {
    key: "summary_and_handoff",
    label: "Summary and team handoff",
    purpose: "Find the existing summary and team-coordination tabs without reading clinical content or preparing a handoff through the Assistant.",
    destinations: [
      { label: "Summaries", href: "/workspace?role=trainer&tab=summaries", purpose: "Open the Fitness Trainer Summaries tab." },
      { label: "Concerns", href: "/workspace?role=trainer&tab=concerns", purpose: "Open the Fitness Trainer Concerns tab." },
      { label: "MDT board", href: "/workspace?role=trainer&tab=board", purpose: "Open the Fitness Trainer MDT board tab." },
    ],
  },
] as const;

export type FitnessTrainerWorkflowKey = (typeof FITNESS_TRAINER_WORKFLOWS)[number]["key"];

export type FitnessTrainerOperationalDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Fitness Trainer";
    workflowKey: FitnessTrainerWorkflowKey;
    destinations: { label: string; href: string; purpose: string }[];
  };
};

export function isFitnessTrainerWorkflowKey(value: string): value is FitnessTrainerWorkflowKey {
  return FITNESS_TRAINER_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function fitnessTrainerWorkflowProblem(value: string) {
  return isFitnessTrainerWorkflowKey(value)
    ? null
    : "Choose one approved Fitness Trainer workflow from the list.";
}

export function buildFitnessTrainerOperationalDraft(workflowKey: FitnessTrainerWorkflowKey): FitnessTrainerOperationalDraft {
  const workflow = FITNESS_TRAINER_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Fitness Trainer", FITNESS_TRAINER_OPERATIONAL_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Fitness Trainer operational task policy is missing.");

  const steps = workflow.destinations.map((destination, index) =>
    `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`,
  );

  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} workspace checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`,
      "",
      ...steps,
      "",
      "At each destination, independently verify the relevant item, assignment, permission, safety state and current status from the page before following the approved Cureocity process.",
      "If the workspace, permission or process differs from this checklist, stop and ask a Manager or appropriate clinical supervisor. The Assistant has not inspected any record and cannot confirm that work exists, is safe, is eligible, or is complete.",
    ].join("\n"),
    evidence: workflow.destinations.map((destination) =>
      `${destination.label} is an existing Fitness Trainer-visible workspace destination at ${destination.href}.`,
    ),
    caution: "Static navigation and process orientation only. No client, clinical, assessment, workout, session, finance, HR, staff or message record was read; nothing was prescribed, scheduled, completed, changed, submitted, published or sent.",
    context: {
      role: "Fitness Trainer",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
    },
  };
}
