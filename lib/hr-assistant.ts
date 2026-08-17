import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  HR_PROCESS_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const HR_WORKFLOWS = [
  {
    key: "onboarding_offboarding_process",
    label: "Onboarding and offboarding process",
    destinations: [
      { label: "On / offboarding", href: "/hr?tab=boarding", purpose: "Open the existing HR checklist workspace." },
      { label: "Employees", href: "/hr?tab=employees", purpose: "Open the existing employee administration area for independent review." },
      { label: "Knowledge base", href: "/kb", purpose: "Open approved policies and SOPs." },
    ],
    checks: [
      "Independently verify the authorized person, process type, effective date, checklist owner, required notice or consent, source documents and role separation.",
      "Use current approved policy and the existing human-controlled onboarding or offboarding workflow.",
      "The Assistant does not read a person or document, create or complete a checklist, provision or remove access, change employment state, upload a document or contact anyone.",
    ],
  },
  {
    key: "attendance_leave_process",
    label: "Attendance and leave process",
    destinations: [
      { label: "Staff & Attendance", href: "/hr?tab=attendance", purpose: "Open the existing attendance workspace." },
      { label: "Leave", href: "/hr?tab=leave", purpose: "Open the existing leave workflow." },
      { label: "Roster", href: "/hr?tab=roster", purpose: "Open the existing roster view." },
    ],
    checks: [
      "Independently verify staff identity, date and time, source evidence, status, applicable policy, entitlement basis and required approver.",
      "Keep evidence review, entitlement calculation, approval, roster impact and payroll impact with their authorized human owners.",
      "The Assistant does not read attendance or leave records, mark attendance, calculate entitlement, approve or reject leave, change a roster, change payroll or contact anyone.",
    ],
  },
  {
    key: "training_policy_guidance",
    label: "Training and policy guidance",
    destinations: [
      { label: "Knowledge base", href: "/kb", purpose: "Open approved policies and SOPs." },
      { label: "Employees", href: "/hr?tab=employees", purpose: "Open the existing employee administration area for authorized independent review." },
      { label: "On / offboarding", href: "/hr?tab=boarding", purpose: "Open the existing checklist workspace." },
    ],
    checks: [
      "Independently verify the policy or SOP owner, approved version, effective date, intended audience, required acknowledgement and training owner.",
      "Use only published Cureocity policy; escalate unclear or conflicting guidance to the authorized policy owner.",
      "The Assistant does not read personnel or training records, assess competence or compliance, assign training, acknowledge policy, publish documents or contact anyone.",
    ],
  },
  {
    key: "capacity_privacy_review",
    label: "Capacity and privacy review",
    destinations: [
      { label: "Roster", href: "/hr?tab=roster", purpose: "Open the existing roster view for authorized independent review." },
      { label: "Staff & Attendance", href: "/hr?tab=attendance", purpose: "Open the existing attendance workspace." },
      { label: "Holidays", href: "/hr?tab=holidays", purpose: "Open the existing holiday calendar." },
    ],
    checks: [
      "Treat counts and schedules as incomplete operational signals; independently verify coverage needs, approved availability, privacy limits and responsible decision-maker.",
      "Do not rank individuals, infer health or protected traits, or use capacity information as the sole basis for an employment or performance decision.",
      "The Assistant does not read staff, attendance, roster or leave records, score or rank people, assign work, decide performance or discipline, approve leave, hire, terminate, change access or contact anyone.",
    ],
  },
] as const;

export type HrWorkflowKey = (typeof HR_WORKFLOWS)[number]["key"];
export type HrProcessDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: { role: "HR"; workflowKey: HrWorkflowKey; destinations: { label: string; href: string; purpose: string }[]; checks: string[] };
};

export function isHrWorkflowKey(value: string): value is HrWorkflowKey {
  return HR_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function hrWorkflowProblem(value: string) {
  return isHrWorkflowKey(value) ? null : "Choose one approved HR process from the list.";
}

export function buildHrProcessDraft(workflowKey: HrWorkflowKey): HrProcessDraft {
  const workflow = HR_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("HR", HR_PROCESS_TASK_KEY);
  if (!workflow || !manifest) throw new Error("HR task policy is missing.");
  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`, "", "Navigation",
      ...workflow.destinations.map((destination, index) => `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`),
      "", "HR controls", ...workflow.checks.map((check, index) => `${index + 1}. ${check}`), "",
      "Independently verify the real person, permission, policy, effective date, evidence, consent or notice, owner, reviewer, privacy boundary and approved Cureocity HR workflow before taking any action.",
      "The Assistant has not inspected any staff, attendance, leave, roster, payroll, salary, recruitment, onboarding, offboarding, training, performance, complaint, health, document, access or message record and cannot confirm that anything exists, is current, complete, accurate, eligible, approved, compliant, safe or resolved.",
    ].join("\n"),
    evidence: [
      ...workflow.destinations.map((destination) => `${destination.label} is an existing HR-visible destination at ${destination.href}.`),
      ...workflow.checks.map((check) => `Approved static HR boundary: ${check}`),
    ],
    caution: "Static navigation and HR-process orientation only. No staff, attendance, leave, roster, payroll, salary, recruitment, onboarding, offboarding, training, performance, complaint, health, government-ID, document, access or message record was read; nobody was scored, ranked, assessed, hired, terminated, disciplined, compensated, assigned, approved, rejected, changed, provisioned, removed or contacted.",
    context: {
      role: "HR",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
      checks: [...workflow.checks],
    },
  };
}
