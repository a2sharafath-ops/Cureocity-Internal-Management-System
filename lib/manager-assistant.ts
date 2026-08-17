import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  MANAGER_OPERATIONS_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const MANAGER_WORKFLOWS = [
  {
    key: "coverage_coordination",
    label: "Coverage coordination",
    purpose: "Find the existing schedule and follow-up areas without reading assignments or changing coverage through the Assistant.",
    destinations: [
      { label: "Appointment Calendar", href: "/appointments", purpose: "Open the existing appointment calendar for an independent authorized review." },
      { label: "Training Schedule", href: "/sessions", purpose: "Open the existing training schedule for an independent authorized review." },
      { label: "Follow-ups", href: "/followups", purpose: "Open the existing follow-up area for an independent authorized review." },
    ],
  },
  {
    key: "coach_quality_review",
    label: "Coach quality review",
    purpose: "Find the existing Manager oversight areas without reading coaching or clinical records through the Assistant.",
    destinations: [
      { label: "Coach Quality", href: "/workspace", purpose: "Open the Manager's existing Coach Quality oversight workspace." },
      { label: "Care Team", href: "/careteam", purpose: "Open the existing care-team coordination area for an independent authorized review." },
      { label: "Governance & Interop", href: "/compliance", purpose: "Open the existing governance and interoperability area." },
    ],
  },
  {
    key: "onboarding_handover",
    label: "Onboarding handover",
    purpose: "Find the existing onboarding handover areas without reading client records, assigning work or contacting anyone through the Assistant.",
    destinations: [
      { label: "Clients", href: "/clients", purpose: "Open the existing client index for an independent authorized review." },
      { label: "Onboarding", href: "/onboarding", purpose: "Open the existing onboarding area for an independent authorized review." },
      { label: "Follow-ups", href: "/followups", purpose: "Open the existing follow-up area for an independent authorized review." },
    ],
  },
  {
    key: "service_operations_review",
    label: "Service operations review",
    purpose: "Find the existing service configuration areas without reading finance records or changing packages, services or templates through the Assistant.",
    destinations: [
      { label: "Packages", href: "/packages", purpose: "Open the existing package area for an independent authorized review." },
      { label: "Services", href: "/services", purpose: "Open the existing service area for an independent authorized review." },
      { label: "Templates & Branding", href: "/templates", purpose: "Open the existing template and branding area for an independent authorized review." },
    ],
  },
] as const;

export type ManagerWorkflowKey = (typeof MANAGER_WORKFLOWS)[number]["key"];

export type ManagerOperationsDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Manager";
    workflowKey: ManagerWorkflowKey;
    destinations: { label: string; href: string; purpose: string }[];
  };
};

export function isManagerWorkflowKey(value: string): value is ManagerWorkflowKey {
  return MANAGER_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function managerWorkflowProblem(value: string) {
  return isManagerWorkflowKey(value)
    ? null
    : "Choose one approved Manager operations workflow from the list.";
}

export function buildManagerOperationsDraft(workflowKey: ManagerWorkflowKey): ManagerOperationsDraft {
  const workflow = MANAGER_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Manager", MANAGER_OPERATIONS_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Manager operations task policy is missing.");

  const steps = workflow.destinations.map((destination, index) =>
    `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`,
  );

  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`,
      "",
      ...steps,
      "",
      "At each destination, independently verify the real current state, your permission, ownership and the approved Cureocity process before taking any action in that page.",
      "If the page, permission, ownership or process differs from this checklist, stop and escalate through the approved management path. The Assistant has not inspected any record and cannot confirm that a client, appointment, session, follow-up, handover, quality item, package, service or template exists or is complete.",
    ].join("\n"),
    evidence: workflow.destinations.map((destination) =>
      `${destination.label} is an existing Manager-visible destination at ${destination.href}.`,
    ),
    caution: "Static navigation and process orientation only. No client, clinical, coach, appointment, session, finance, HR, staff, access, message or other application record was read; nothing was assigned, scheduled, changed, approved, completed, configured, published, sent or deleted.",
    context: {
      role: "Manager",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
    },
  };
}
