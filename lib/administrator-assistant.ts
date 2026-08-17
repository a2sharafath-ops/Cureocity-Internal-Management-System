import {
  ADMINISTRATOR_GOVERNANCE_TASK_KEY,
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const ADMINISTRATOR_WORKFLOWS = [
  {
    key: "access_governance",
    label: "Access governance",
    purpose: "Find the existing access-review and audit areas without reading staff records or changing a role through the Assistant.",
    destinations: [
      { label: "Users & Roles", href: "/users", purpose: "Open the existing staff access-management area for an independent authorized review." },
      { label: "Audit Log", href: "/audit", purpose: "Open the existing audit trail for an independent authorized review." },
      { label: "Governance & Interop", href: "/compliance", purpose: "Open the existing governance and interoperability area." },
    ],
  },
  {
    key: "issue_governance",
    label: "Issue governance",
    purpose: "Find the existing issue-triage and governance areas without reading, resolving or changing an issue through the Assistant.",
    destinations: [
      { label: "Issue Reports", href: "/issues", purpose: "Open the existing application issue triage area." },
      { label: "Governance & Interop", href: "/compliance", purpose: "Open the existing governance and interoperability area." },
      { label: "Audit Log", href: "/audit", purpose: "Open the existing audit trail for an independent authorized review." },
    ],
  },
  {
    key: "service_configuration_review",
    label: "Service configuration review",
    purpose: "Find the existing commercial configuration areas without reading financial records or changing packages, services or templates through the Assistant.",
    destinations: [
      { label: "Packages", href: "/packages", purpose: "Open the existing package configuration area for an independent authorized review." },
      { label: "Services", href: "/services", purpose: "Open the existing service configuration area for an independent authorized review." },
      { label: "Templates & Branding", href: "/templates", purpose: "Open the existing template and branding area for an independent authorized review." },
    ],
  },
  {
    key: "operational_oversight",
    label: "Operational oversight",
    purpose: "Find existing operational process areas without reading client records, contacting anyone or changing workflow state through the Assistant.",
    destinations: [
      { label: "Onboarding", href: "/onboarding", purpose: "Open the existing onboarding area for an independent authorized review." },
      { label: "Follow-ups", href: "/followups", purpose: "Open the existing follow-up area for an independent authorized review." },
      { label: "Retention", href: "/retention", purpose: "Open the existing retention area for an independent authorized review." },
    ],
  },
] as const;

export type AdministratorWorkflowKey = (typeof ADMINISTRATOR_WORKFLOWS)[number]["key"];

export type AdministratorGovernanceDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Administrator";
    workflowKey: AdministratorWorkflowKey;
    destinations: { label: string; href: string; purpose: string }[];
  };
};

export function isAdministratorWorkflowKey(value: string): value is AdministratorWorkflowKey {
  return ADMINISTRATOR_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function administratorWorkflowProblem(value: string) {
  return isAdministratorWorkflowKey(value)
    ? null
    : "Choose one approved Administrator governance workflow from the list.";
}

export function buildAdministratorGovernanceDraft(workflowKey: AdministratorWorkflowKey): AdministratorGovernanceDraft {
  const workflow = ADMINISTRATOR_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Administrator", ADMINISTRATOR_GOVERNANCE_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Administrator governance task policy is missing.");

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
      "At each destination, independently verify the real current state, your permission and the approved Cureocity process before doing anything in that page.",
      "If the page, permission or process differs from this checklist, stop and escalate through the approved governance path. The Assistant has not inspected any record and cannot confirm that an issue, user, package, service, onboarding item, follow-up or retention item exists or is complete.",
    ].join("\n"),
    evidence: workflow.destinations.map((destination) =>
      `${destination.label} is an existing Administrator-visible destination at ${destination.href}.`,
    ),
    caution: "Static navigation and process orientation only. No client, clinical, finance, HR, staff, access, issue, message or other application record was read; nothing was changed, resolved, approved, assigned, configured, published, sent or deleted.",
    context: {
      role: "Administrator",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
    },
  };
}
