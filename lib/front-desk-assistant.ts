import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  FRONT_DESK_OPERATIONAL_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const FRONT_DESK_WORKFLOWS = [
  {
    key: "lead_intake",
    label: "Lead intake",
    purpose: "Find the existing lead and intake areas without inspecting or changing a record through the Assistant.",
    destinations: [
      { label: "CRM & Leads", href: "/leads", purpose: "Open the lead work area." },
      { label: "Tablet Intake", href: "/intake", purpose: "Open the intake work area." },
    ],
  },
  {
    key: "client_onboarding",
    label: "Client onboarding",
    purpose: "Find the existing client, onboarding and consent areas without evaluating an individual client.",
    destinations: [
      { label: "Clients", href: "/clients", purpose: "Open the client roster and its Onboarding tab." },
      { label: "Onboarding", href: "/onboarding", purpose: "Open the Front Desk onboarding view." },
      { label: "Forms & Consent", href: "/forms", purpose: "Open the forms and consent area." },
    ],
  },
  {
    key: "appointment_coordination",
    label: "Appointment coordination",
    purpose: "Find the existing calendars without selecting, booking, rescheduling or cancelling an appointment through the Assistant.",
    destinations: [
      { label: "Appointment Calendar", href: "/appointments", purpose: "Open the appointment calendar." },
      { label: "Training Schedule", href: "/sessions", purpose: "Open the strength-session schedule." },
    ],
  },
  {
    key: "follow_up_queue",
    label: "Follow-up and retention",
    purpose: "Find the existing follow-up areas without reading contact details or preparing outreach.",
    destinations: [
      { label: "Follow-ups", href: "/followups", purpose: "Open the follow-up queue." },
      { label: "Retention", href: "/retention", purpose: "Open the retention work area." },
    ],
  },
] as const;

export type FrontDeskWorkflowKey = (typeof FRONT_DESK_WORKFLOWS)[number]["key"];

export type FrontDeskOperationalDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Front Desk";
    workflowKey: FrontDeskWorkflowKey;
    destinations: { label: string; href: string; purpose: string }[];
  };
};

export function isFrontDeskWorkflowKey(value: string): value is FrontDeskWorkflowKey {
  return FRONT_DESK_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function frontDeskWorkflowProblem(value: string) {
  return isFrontDeskWorkflowKey(value)
    ? null
    : "Choose one approved Front Desk workflow from the list.";
}

export function buildFrontDeskOperationalDraft(workflowKey: FrontDeskWorkflowKey): FrontDeskOperationalDraft {
  const workflow = FRONT_DESK_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Front Desk", FRONT_DESK_OPERATIONAL_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Front Desk operational task policy is missing.");

  const steps = workflow.destinations.map((destination, index) =>
    `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`,
  );

  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} navigation checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`,
      "",
      ...steps,
      "",
      "At each destination, independently verify the relevant item, ownership, permissions and current state from the page before proceeding under the approved Cureocity process.",
      "If the page, permission or process differs from this route checklist, stop and ask a Manager. The Assistant has not inspected any record and cannot confirm that work exists, is eligible, or is complete.",
    ].join("\n"),
    evidence: workflow.destinations.map((destination) =>
      `${destination.label} is an existing Front Desk-visible route at ${destination.href}.`,
    ),
    caution: "Static navigation and process orientation only. No client, clinical, finance, HR, staff, appointment or message record was read; nothing was contacted, scheduled, changed, submitted or completed.",
    context: {
      role: "Front Desk",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
    },
  };
}
